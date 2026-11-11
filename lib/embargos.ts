export type EstadoEmbargo = 'ESPERA' | 'ACTIVO' | 'NO_IMPUTACION' | 'BAJA' | 'CANCELADO'

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
    value: 'NO_IMPUTACION',
    letra: 'N',
    label: 'No imputación',
    descripcion: 'Embargo cancelado con una cuota pendiente de revisión.',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClass: 'bg-violet-500',
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
 * Formatea el N° interno de retenciones con el formato 000.000/00.
 * El número es un correlativo que asigna la base al crear el embargo.
 * Los registros históricos de 9 dígitos se muestran con el formato anterior
 * (000.000/000) para no perder información.
 */
export function formatExpedienteRetenciones(numero: number | null | undefined): string {
  const value = Number(numero ?? 0)
  if (!Number.isInteger(value) || value <= 0) return ''
  const padded = String(value).padStart(8, '0')
  if (padded.length === 9) return `${padded.slice(0, 3)}.${padded.slice(3, 6)}/${padded.slice(6)}`
  if (padded.length > 9) return String(value)
  return `${padded.slice(0, 3)}.${padded.slice(3, 6)}/${padded.slice(6, 8)}`
}

/**
 * Enmascara lo que escribe el operador para el N° de expediente de
 * retenciones: sólo dígitos, máximo 8, con el formato 000.000/00.
 */
export function formatExpedienteRetencionesInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''
  const parte1 = digits.slice(0, 3)
  const parte2 = digits.slice(3, 6)
  const parte3 = digits.slice(6, 8)
  let resultado = parte1
  if (digits.length > 3) resultado += `.${parte2}`
  if (digits.length > 6) resultado += `/${parte3}`
  return resultado
}

/**
 * Convierte el N° de expediente de retenciones escrito por el operador
 * (por ejemplo "000.123/45") al entero correlativo que guarda la base.
 * Devuelve null si no hay dígitos o si supera los 8 dígitos permitidos.
 */
export function parseExpedienteRetenciones(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits || digits.length > 8) return null
  const parsed = Number(digits)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null
  return parsed
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
  /** N° interno de retenciones, formato 000.000/00. */
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
  /** Monto bruto legado. No se usa para el cálculo de la retención. */
  sueldo: number
  /** Monto bruto legado. No se usa para el cálculo de la retención. */
  refrigerio: number
  /** Importe retenido del sueldo ese mes. */
  retencionSueldo: number
  /** Importe retenido del refrigerio ese mes. */
  retencionRefrigerio: number
  /** Salario mínimo legado. No interviene en la carga manual. */
  salarioMinimo: number
  /** Suma de las retenciones de sueldo y refrigerio. */
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
  /** N° interno de retenciones editable; se guarda como entero. */
  expedienteRetenciones: string
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
  /** Importe que se retiene del sueldo. */
  retencionSueldo: string
  /** Importe que se retiene del refrigerio. */
  retencionRefrigerio: string
  devolucion: string
  observaciones: string
}

/** Salario mínimo legado de la base. No se usa para calcular retenciones. */
export const SALARIO_MINIMO_DEFAULT = 398800

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

/** Filtros de fecha de alta utilizados por las consultas de Altas y Activos sin retención. */
export interface ConsultaRangoFiltros {
  fechaDesde?: string
  fechaHasta?: string
  periodo?: string
}

export interface ResumenRetencion {
  idRetencion: number
  periodo: string
  dni: string
  agente: string
  autos: string
  expediente: string
  retencionSueldo: number
  retencionRefrigerio: number
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
  { value: 'NO_IMPUTACIONES', label: 'No imputaciones', ayuda: 'Embargos cancelados con una cuota nueva pendiente de revisión, de los DNI ingresados.' },
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

export function formatMoneyTyping(input: string): string {
  if (!input) return ''
  const normalized = input.trim()
  // Sólo se aceptan dígitos y coma decimal. El punto no se usa como separador
  // decimal: se reserva para los miles del formato es-AR.
  const clean = normalized.replace(/[^\d,]/g, '')
  if (!clean) return ''

  let integerRaw = ''
  let decimalRaw = ''
  if (clean.includes(',')) {
    const parts = clean.split(',')
    integerRaw = parts[0]
    decimalRaw = parts.slice(1).join('')
  } else {
    integerRaw = clean
  }

  const integerDigits = integerRaw.replace(/\D/g, '')
  if (!integerDigits && !clean.includes(',')) return ''

  let formattedInteger = ''
  if (integerDigits) {
    try {
      formattedInteger = BigInt(integerDigits).toLocaleString('es-AR')
    } catch {
      formattedInteger = integerDigits
    }
  } else {
    formattedInteger = '0'
  }

  if (clean.includes(',')) {
    const decimalDigits = decimalRaw.replace(/\D/g, '').slice(0, 2)
    return formattedInteger + ',' + decimalDigits
  }

  return formattedInteger
}

export function moneyToInput(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount) || amount === 0) return ''
  return formatMoneyTyping(amount.toFixed(2).replace('.', ','))
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

const PRIORIDAD_ESTADO_EMBARGO: Record<string, number> = {
  ACTIVO: 0,
  ESPERA: 1,
  NO_IMPUTACION: 2,
  // Baja y cancelado son estados cerrados: se muestran al final, juntos y en
  // orden cronológico.
  BAJA: 3,
  CANCELADO: 3,
}

function fechaOrdenable(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!match) return value.trim()
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

/**
 * Ordena los embargos de un agente para la ficha:
 * primero el activo, luego los que están en espera según fueron cargados y
 * por último los cerrados (baja/cancelado) en orden cronológico.
 */
export function ordenarEmbargos<T extends Pick<Embargo, 'id' | 'estado' | 'fechaAlta'>>(embargos: T[]): T[] {
  return [...embargos].sort((a, b) => {
    const prioridadA = PRIORIDAD_ESTADO_EMBARGO[a.estado] ?? 9
    const prioridadB = PRIORIDAD_ESTADO_EMBARGO[b.estado] ?? 9
    if (prioridadA !== prioridadB) return prioridadA - prioridadB

    const fechaA = fechaOrdenable(a.fechaAlta)
    const fechaB = fechaOrdenable(b.fechaAlta)
    if (fechaA !== fechaB) return fechaA.localeCompare(fechaB)
    return a.id - b.id
  })
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
