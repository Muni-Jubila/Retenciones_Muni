export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const formatoFechaHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Fecha de un timestamp (DateTime) en horario de Buenos Aires. */
export function fechaBuenosAires(value: Date | string | null | undefined): string {
  if (!value) return ''
  const fecha = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(fecha.getTime())) return ''
  return formatoFecha.format(fecha)
}

export function fechaHoraBuenosAires(value: Date | string | null | undefined): string {
  if (!value) return ''
  const fecha = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(fecha.getTime())) return ''
  return formatoFechaHora.format(fecha)
}

/** Formatea una fecha de calendario como dd/mm/aaaa para inputs. */
export function fechaInputBuenosAires(value: Date): string {
  return formatoFecha.format(value)
}

/**
 * Interpreta dd/mm/aaaa como un día completo en Buenos Aires (UTC-3).
 * Devuelve el inicio y el inicio del día siguiente, para usar con gte/lt.
 */
export function rangoDiaBuenosAires(value: string): { desde: Date; hastaExclusivo: Date } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return {
    desde: new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)),
    hastaExclusivo: new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0, 0)),
  }
}

/** Rango de un período aaaa-mm en horario de Buenos Aires. */
export function rangoPeriodoBuenosAires(periodo: string): { desde: Date; hastaExclusivo: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodo.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return {
    desde: new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0)),
    hastaExclusivo: new Date(Date.UTC(year, month, 1, 3, 0, 0, 0)),
  }
}
