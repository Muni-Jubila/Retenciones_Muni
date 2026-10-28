export type EstadoEmbargo = 'ESPERA' | 'ACTIVO' | 'BAJA' | 'CANCELADO'

export interface EstadoEmbargoConfig {
  value: EstadoEmbargo
  letra: string
  label: string
  descripcion: string
  badgeClass: string
  dotClass: string
}

export const ESTADOS_EMBARGO: EstadoEmbargoConfig[] = [
  {
    value: 'ESPERA',
    letra: 'E',
    label: 'En espera',
    descripcion: 'Embargo cargado, pendiente de imputación.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'ACTIVO',
    letra: 'A',
    label: 'Activo',
    descripcion: 'Embargo con retención vigente.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'BAJA',
    letra: 'B',
    label: 'Baja',
    descripcion: 'Embargo dado de baja. Puede conservar saldo.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  {
    value: 'CANCELADO',
    letra: 'C',
    label: 'Cancelado',
    descripcion: 'Deuda cancelada o embargo finalizado.',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
]

export function getEstadoConfig(estado: string): EstadoEmbargoConfig {
  return ESTADOS_EMBARGO.find((item) => item.value === estado) ?? ESTADOS_EMBARGO[0]
}

/**
 * Formatea el N° interno de retenciones con el formato legacy 000.000/000.
 * El número es un correlativo que asigna la base al crear el embargo.
 */
export function formatExpedienteRetenciones(numero: number | null | undefined): string {
  const value = Number(numero ?? 0)
  if (!Number.isInteger(value) || value <= 0) return ''
  const padded = String(value).padStart(9, '0')
  if (padded.length > 9) return String(value)
  return `${padded.slice(0, 3)}.${padded.slice(3, 6)}/${padded.slice(6)}`
}

export interface Embargo {
  id: number
  idAgente: number
  dni: string
  agente: string
  estado: EstadoEmbargo
  autos: string
  /** N° de expediente judicial (SAC). */
  expediente: string
  /** N° interno de retenciones, formato 000.000/000. */
  expedienteRetenciones: string
  fechaExpediente: string
  cuenta: string
  sucursal: string
  juez: string
  instancia: string
  nomenclatura: string
  tipoProceso: string
  secretaria: string
  deuda: number
  importeMensual: number
  porcentaje: number
  marcaEspecial: string
  observaciones: string
  fechaAlta: string
  fechaBaja: string
  motivoBaja: string
  saldoActual: number
  totalRetenido: number
  totalDevuelto: number
  cantidadRetenciones: number
  primerPeriodo: string
  ultimoPeriodo: string
  programa: string
  secretariaAgente: string
  cargo: string
}

export interface RetencionEmbargo {
  id: number
  idEmbargo: number
  periodo: string
  sueldo: number
  refrigerio: number
  retencionMensual: number
  saldo: number
  devolucion: number
  observaciones: string
  fechaRegistro: string
}

export interface EmbargoInput {
  idAgente: number
  estado: string
  autos: string
  expediente: string
  fechaExpediente: string
  cuenta: string
  sucursal: string
  juez: string
  instancia: string
  nomenclatura: string
  tipoProceso: string
  secretaria: string
  deuda: string
  importeMensual: string
  porcentaje: string
  marcaEspecial: string
  observaciones: string
}

export interface RetencionInput {
  idEmbargo: number
  periodo: string
  sueldo: string
  refrigerio: string
  retencionMensual: string
  devolucion: string
  observaciones: string
}

export interface ConsultaEmbargosFiltros {
  tipo?:
    | 'TODAS'
    | 'AGENTE'
    | 'PROGRAMA'
    | 'EXPEDIENTE'
    | 'CANCELACIONES'
    | 'DEVOLUCIONES'
    | 'NO_IMPUTACIONES'
    | 'ALTAS'
    | 'BAJAS_COBRANDO'
    | 'BAJAS_REN_DEC'
    | 'ACTIVOS_SIN_RETENCION'
    | 'PRIMER_MES'
  dnis?: string[]
  texto?: string
  estado?: string
  periodo?: string
}

export interface ResumenRetencion {
  idRetencion: number
  periodo: string
  dni: string
  agente: string
  autos: string
  expediente: string
  sueldo: number
  refrigerio: number
  retencionMensual: number
  devolucion: number
  saldo: number
}

export const TIPOS_CONSULTA: { value: NonNullable<ConsultaEmbargosFiltros['tipo']>; label: string; ayuda: string; inputLabel?: string }[] = [
  { value: 'TODAS', label: 'Todas', ayuda: 'Todos los embargos de los DNI ingresados.' },
  { value: 'AGENTE', label: 'Por agente', ayuda: 'Embargos de los agentes según los DNI ingresados.' },
  { value: 'PROGRAMA', label: 'Por programa', ayuda: 'Embargos de los DNI ingresados, filtrados por código o nombre del programa.', inputLabel: 'Programa' },
  { value: 'EXPEDIENTE', label: 'Por expediente', ayuda: 'Embargos de los DNI ingresados, filtrados por número de expediente.', inputLabel: 'Número de expediente' },
  { value: 'CANCELACIONES', label: 'Cancelaciones', ayuda: 'Embargos cancelados (deuda saldada o finalizados) de los DNI ingresados.' },
  { value: 'DEVOLUCIONES', label: 'Devoluciones', ayuda: 'Retenciones con importes devueltos al agente, de los DNI ingresados.' },
  { value: 'NO_IMPUTACIONES', label: 'No imputaciones', ayuda: 'Embargos en espera que todavía no registran retenciones, de los DNI ingresados.' },
  { value: 'ALTAS', label: 'Consultas de altas', ayuda: 'Embargos dados de alta en los últimos 30 días, de los DNI ingresados.' },
  { value: 'BAJAS_COBRANDO', label: 'Bajas cobrando', ayuda: 'Embargos en baja que todavía conservan saldo pendiente, de los DNI ingresados.' },
  { value: 'BAJAS_REN_DEC', label: 'Bajas x Ren./Dec.', ayuda: 'Embargos dados de baja por renuncia o decreto, de los DNI ingresados.', inputLabel: 'Expediente, autos o motivo (opcional)' },
  { value: 'ACTIVOS_SIN_RETENCION', label: 'Activos sin retención', ayuda: 'Embargos activos sin ninguna retención imputada, de los DNI ingresados.' },
  { value: 'PRIMER_MES', label: 'Primer mes de retención', ayuda: 'Primer período retenido de cada embargo, de los DNI ingresados.' },
]

const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
]

export function periodoActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function periodoLabel(periodo: string): string {
  if (!periodo) return '—'
  const [year, month] = periodo.split('-')
  const index = Number(month) - 1
  if (!year || !Number.isInteger(index) || index < 0 || index > 11) return periodo
  return `${MESES[index]}/${year.slice(-2)}`
}

export function periodoCorto(periodo: string): string {
  if (!periodo) return '—'
  const [year, month] = periodo.split('-')
  const index = Number(month) - 1
  if (!year || !Number.isInteger(index) || index < 0 || index > 11) return periodo
  return `${MESES[index].slice(0, 4)}/${year.slice(-2)}`
}

export function parseMoneyInput(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let cleaned = value.trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!cleaned) return 0
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = cleaned.split('.')
    // "1.234" sin decimales se interpreta como miles; "1234.56" como decimal.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = parts.join('')
    }
  }
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(value: number | null | undefined, withSymbol = true): string {
  const amount = Number(value ?? 0)
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
  return withSymbol ? `$ ${formatted}` : formatted
}

export function moneyToInput(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount) || amount === 0) return ''
  return amount.toFixed(2).replace('.', ',')
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function resumenEstados(embargos: Embargo[]) {
  return {
    total: embargos.length,
    activos: embargos.filter((item) => item.estado === 'ACTIVO').length,
    espera: embargos.filter((item) => item.estado === 'ESPERA').length,
    deuda: roundMoney(embargos.reduce((acc, item) => acc + item.deuda, 0)),
    retenido: roundMoney(embargos.reduce((acc, item) => acc + item.totalRetenido, 0)),
    saldo: roundMoney(embargos.reduce((acc, item) => acc + item.saldoActual, 0)),
  }
}

export function csvEscape(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(';'))
    .join('\r\n')
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8',
  withBom = true,
): void {
  const blob = new Blob([withBom ? `\uFEFF${content}` : content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function todayFileSuffix(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}
