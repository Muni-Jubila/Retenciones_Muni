'use server'

// pdf.js (incluido en unpdf) usa los iterator helpers de ES2025. Next.js soporta
// Node 20, que todavía no los trae, así que registramos el polyfill antes de
// cargar el extractor.
import 'core-js/proposals/iterator-helpers'
import { extractText } from 'unpdf'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { buscarEmpleados } from '@/app/actions/empleados'
import { parseOficio, normalizarDni, type DatosOficio } from '@/lib/oficio-parser'
import type { Empleado } from '@/lib/empleados'
import { logServerError } from '@/lib/safe-error'

const MAX_PDF_BYTES = 6 * 1024 * 1024

export interface AnalizarOficioInput {
  nombreArchivo: string
  contenidoBase64: string
}

export interface AnalizarOficioResult {
  ok: boolean
  error?: string
  datos?: DatosOficio
  agente?: Empleado | null
  advertencias: string[]
}

function base64ToBuffer(base64: string): Buffer {
  // El navegador puede enviar "data:application/pdf;base64,..." o variantes con
  // otro MIME (por ejemplo application/octet-stream).
  const clean = base64.replace(/^data:[^;]*;base64,/, '').replace(/\s/g, '')
  return Buffer.from(clean, 'base64')
}

export async function analizarOficioJudicial(input: AnalizarOficioInput): Promise<AnalizarOficioResult> {
  try {
    await requireAuthenticatedSession()

    if (!input || typeof input.contenidoBase64 !== 'string' || !input.contenidoBase64.trim()) {
      return { ok: false, error: 'No se recibió el archivo PDF.', advertencias: [] }
    }

    const buffer = base64ToBuffer(input.contenidoBase64)
    if (buffer.length === 0) {
      return { ok: false, error: 'El archivo PDF está vacío.', advertencias: [] }
    }
    if (buffer.length > MAX_PDF_BYTES) {
      return { ok: false, error: 'El PDF supera el tamaño máximo permitido (6 MB).', advertencias: [] }
    }
    if (!buffer.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
      return { ok: false, error: 'El archivo no parece ser un PDF válido.', advertencias: [] }
    }

    let text = ''
    try {
      const extraido = await extractText(new Uint8Array(buffer), { mergePages: true })
      text = typeof extraido.text === 'string' ? extraido.text : ''
    } catch (error) {
      logServerError('[analizarOficioJudicial] Error al extraer texto:', error)
      return {
        ok: false,
        error: 'No se pudo leer el texto del PDF. Verificá que no esté protegido o que sea un PDF con texto (no una imagen escaneada).',
        advertencias: [],
      }
    }

    if (!text.trim()) {
      return {
        ok: false,
        error: 'El PDF no contiene texto seleccionable. Si es un escaneo, primero hay que pasarlo por OCR.',
        advertencias: [],
      }
    }

    const datos = parseOficio(text, input.nombreArchivo ?? '')
    const advertencias = [...datos.advertencias]

    let agente: Empleado | null = null
    if (datos.dni) {
      try {
        const encontrados = await buscarEmpleados(datos.dni)
        const dniBuscado = normalizarDni(datos.dni)
        agente = encontrados.find((empleado) => normalizarDni(empleado.dni) === dniBuscado) ?? null
      } catch (error) {
        logServerError('[analizarOficioJudicial] Error al buscar el agente:', error)
        advertencias.push('No se pudo consultar la base de agentes.')
      }

      if (!agente) {
        advertencias.push(
          `No se encontró un agente con DNI ${datos.dni}. Podés buscarlo manualmente por DNI, apellido o nombre.`,
        )
      }
    } else {
      advertencias.push('No se pudo detectar el DNI; buscá el agente manualmente.')
    }

    return { ok: true, datos, agente, advertencias }
  } catch (error) {
    logServerError('[analizarOficioJudicial] Error:', error)
    return {
      ok: false,
      error: 'No se pudo procesar el oficio judicial. Verificá la conexión e intentá nuevamente.',
      advertencias: [],
    }
  }
}
