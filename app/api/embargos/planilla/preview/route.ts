import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { eliminarCarga, leerCarga } from '@/lib/carga-archivos'
import { logServerError } from '@/lib/safe-error'
import {
  analizarPlanillaRetencionesArchivo,
  resumenPlanillaVacio,
} from '@/lib/planilla-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function bufferToWebStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return Readable.toWeb(Readable.from(buffer)) as ReadableStream<Uint8Array>
}

/**
 * Recibe la planilla de liquidación y devuelve la vista previa de las
 * retenciones.
 *
 * Acepta dos formatos:
 *  - JSON `{ id }`: archivo subido antes en fragmentos (funciona en Vercel,
 *    donde el body de cada request está limitado a 4,5 MB).
 *  - Body binario directo: se conserva para desarrollo local.
 */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedSession()
  } catch {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'Sesión inválida o vencida. Ingresá nuevamente.' },
      { status: 401 },
    )
  }

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as { id?: string } | null
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) {
      return NextResponse.json(
        { ...resumenPlanillaVacio(), error: 'No se recibió el identificador de la planilla.' },
        { status: 400 },
      )
    }

    const carga = await leerCarga(id)
    if (!carga) {
      return NextResponse.json(
        { ...resumenPlanillaVacio(), error: 'La planilla no se subió completa o la carga venció.' },
        { status: 400 },
      )
    }
    if (!/\.(xlsx|xlsm)$/i.test(carga.nombre)) {
      await eliminarCarga(id)
      return NextResponse.json(
        { ...resumenPlanillaVacio(), error: 'El archivo debe ser una planilla .xlsx o .xlsm.' },
        { status: 400 },
      )
    }

    try {
      const resultado = await analizarPlanillaRetencionesArchivo(bufferToWebStream(carga.buffer))
      return NextResponse.json(resultado)
    } catch (error) {
      logServerError('[planilla/preview] Error:', error)
      return NextResponse.json(
        {
          ...resumenPlanillaVacio(),
          error: error instanceof Error ? error.message : 'No se pudo procesar la planilla.',
        },
        { status: 400 },
      )
    } finally {
      await eliminarCarga(id)
    }
  }

  const nombre = decodeURIComponent(request.headers.get('x-archivo-nombre') ?? '')
  if (!/\.(xlsx|xlsm)$/i.test(nombre)) {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'El archivo debe ser una planilla .xlsx o .xlsm.' },
      { status: 400 },
    )
  }
  if (!request.body) {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'No se recibió el archivo de la planilla.' },
      { status: 400 },
    )
  }

  try {
    const resultado = await analizarPlanillaRetencionesArchivo(
      request.body as ReadableStream<Uint8Array>,
    )
    return NextResponse.json(resultado)
  } catch (error) {
    logServerError('[planilla/preview] Error:', error)
    return NextResponse.json(
      {
        ...resumenPlanillaVacio(),
        error: error instanceof Error ? error.message : 'No se pudo procesar la planilla.',
      },
      { status: 400 },
    )
  }
}
