/**
 * Lectura de la planilla de liquidación mensual (Excel) para importar las
 * retenciones de embargos.
 *
 * El archivo tiene una hoja con una fila de encabezados (Programa, Cargo,
 * Secretaría, Empleado, Apellido y Nombre, Período, Proceso, ..., Código,
 * Concepto, Cantidad, Monto, Tipo de Concepto).
 *
 * Sólo interesan:
 *  - Procesos de Sueldo (haberes mensuales) y Refrigerio REM.
 *  - Filas con Código 8500 ("Embargos Varios"), que indican el importe a
 *    retener ese mes. Si la fila 8500 está en un proceso de Sueldo se imputa
 *    a la retención de sueldo; si está en Refrigerio REM, a la de refrigerio.
 *
 * El período surge de la columna Período (un único período por archivo).
 */

import ExcelJS from 'exceljs'
import type { Stream } from 'node:stream'
import { roundMoney } from '@/lib/embargos'

export type TipoProcesoPlanilla = 'SUELDO' | 'REFRIGERIO'

export interface FilaPlanillaRetencion {
  dni: string
  nombre: string
  retencionSueldo: number
  retencionRefrigerio: number
  total: number
  procesos: string[]
  conceptos: string[]
}

export interface PlanillaRetenciones {
  periodo: string
  filas: FilaPlanillaRetencion[]
  advertencias: string[]
}

interface AcumuladoDni {
  nombre: string
  retencionSueldo: number
  retencionRefrigerio: number
  procesos: Set<string>
  conceptos: Set<string>
}

const CODIGO_EMBARGOS = '8500'

const MESES_PLANILLA: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
}

function normalizar(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function soloDigitos(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

function clasificarProceso(proceso: string): TipoProcesoPlanilla | null {
  const normalizado = normalizar(proceso)
  if (/^sueldo\b/.test(normalizado)) return 'SUELDO'
  // "Refrigerio REM - Octubre 2026" (se excluye "Refrigerio NOREM").
  if (/^refrigerio rem\b/.test(normalizado)) return 'REFRIGERIO'
  return null
}

function normalizarCodigo(value: unknown): string {
  const texto = String(value ?? '').trim()
  if (!texto) return ''
  const digitos = texto.replace(/\D/g, '')
  return digitos.replace(/^0+(?=\d)/, '')
}

function parsePeriodo(value: unknown): string {
  if (value == null || value === '') return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Fecha serial de Excel (base 1899-12-30).
    const fecha = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000)
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
  }

  const texto = String(value).trim()
  let match = texto.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/)
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}`

  match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}`

  match = texto.match(/^(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[2]}-${match[1].padStart(2, '0')}`

  match = texto.match(/^([a-záéíóúñ]+)[\s-]+(?:de\s+)?(\d{4})$/i)
  if (match) {
    const mes = MESES_PLANILLA[normalizar(match[1])]
    if (mes) return `${match[2]}-${mes}`
  }

  return ''
}

function mapearColumnas(values: unknown[]): Record<string, number> | null {
  const columnas: Record<string, number> = {}
  for (let indice = 1; indice < values.length; indice += 1) {
    const encabezado = normalizar(values[indice])
    if (encabezado) columnas[encabezado] = indice
  }
  const requeridas = ['empleado', 'periodo', 'proceso', 'codigo', 'concepto', 'monto']
  if (requeridas.some((nombre) => columnas[nombre] == null)) return null
  return columnas
}

/**
 * Procesa la planilla en streaming: el archivo de ejemplo tiene más de 300 mil
 * filas, por lo que no conviene cargarlo completo en memoria.
 */
export async function parsearPlanillaRetenciones(stream: Stream): Promise<PlanillaRetenciones> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
    entries: 'ignore',
  })

  const acumulados = new Map<string, AcumuladoDni>()
  const periodos = new Set<string>()
  const advertencias: string[] = []
  let columnas: Record<string, number> | null = null
  let filasLeidas = 0
  let ignoradasPorProceso = 0
  let filasSinDni = 0

  for await (const hoja of workbook) {
    for await (const row of hoja) {
      const values = row.values as unknown[]

      if (!columnas) {
        columnas = mapearColumnas(values)
        continue
      }

      filasLeidas += 1
      const dni = soloDigitos(values[columnas['empleado']])
      const proceso = String(values[columnas['proceso']] ?? '').trim()
      const tipo = clasificarProceso(proceso)
      const codigo = normalizarCodigo(values[columnas['codigo']])
      const concepto = String(values[columnas['concepto']] ?? '').trim()

      if (!tipo) {
        if (codigo === CODIGO_EMBARGOS) ignoradasPorProceso += 1
        continue
      }
      if (!dni) {
        if (codigo === CODIGO_EMBARGOS) filasSinDni += 1
        continue
      }

      const periodo = parsePeriodo(values[columnas['periodo']])
      if (periodo) periodos.add(periodo)

      const monto = Number(values[columnas['monto']] ?? 0)
      if (!Number.isFinite(monto) || codigo !== CODIGO_EMBARGOS) continue

      const nombre = columnas['apellido y nombre'] != null
        ? String(values[columnas['apellido y nombre']] ?? '').trim()
        : ''

      let acumulado = acumulados.get(dni)
      if (!acumulado) {
        acumulado = {
          nombre: '',
          retencionSueldo: 0,
          retencionRefrigerio: 0,
          procesos: new Set(),
          conceptos: new Set(),
        }
        acumulados.set(dni, acumulado)
      }
      if (nombre) acumulado.nombre = nombre

      if (tipo === 'SUELDO') {
        acumulado.retencionSueldo += Math.abs(monto)
        acumulado.procesos.add('Sueldo')
      } else {
        acumulado.retencionRefrigerio += Math.abs(monto)
        acumulado.procesos.add('Refrigerio REM')
      }
      if (concepto) acumulado.conceptos.add(concepto)
    }
  }

  if (!columnas) {
    throw new Error('No se encontró la fila de encabezados de la planilla.')
  }
  if (filasLeidas === 0) {
    throw new Error('La planilla no contiene filas de datos.')
  }
  if (periodos.size === 0) {
    throw new Error('No se pudo determinar el período de la planilla.')
  }
  if (periodos.size > 1) {
    const lista = [...periodos].sort().join(', ')
    throw new Error(`La planilla contiene más de un período (${lista}). Debe tener uno solo.`)
  }

  const filas = [...acumulados.entries()]
    .map(([dni, acumulado]) => {
      const retencionSueldo = roundMoney(acumulado.retencionSueldo)
      const retencionRefrigerio = roundMoney(acumulado.retencionRefrigerio)
      return {
        dni,
        nombre: acumulado.nombre,
        retencionSueldo,
        retencionRefrigerio,
        total: roundMoney(retencionSueldo + retencionRefrigerio),
        procesos: [...acumulado.procesos],
        conceptos: [...acumulado.conceptos],
      }
    })
    .filter((fila) => fila.total > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  if (filas.length === 0) {
    advertencias.push('No se encontraron filas con código 8500 (Embargos Varios) en los procesos de Sueldo o Refrigerio REM.')
  }
  if (ignoradasPorProceso > 0) {
    advertencias.push(
      `Se ignoraron ${ignoradasPorProceso} fila(s) de código 8500 en procesos que no son Sueldo ni Refrigerio REM.`,
    )
  }
  if (filasSinDni > 0) {
    advertencias.push(`Se ignoraron ${filasSinDni} fila(s) de código 8500 sin DNI de empleado.`)
  }

  return { periodo: [...periodos][0], filas, advertencias }
}
