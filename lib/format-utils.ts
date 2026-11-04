export function formatDate(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function esAnioBisiesto(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Días del mes indicado. Se calcula sin `Date` para que los años de 4 dígitos
 * (incluidos 0000-0099) no se interpreten como 1900+.
 */
function diasDelMes(month: number, year: number): number {
  const dias = [31, esAnioBisiesto(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return dias[month - 1] ?? 31
}

export function isValidDateString(value: string): boolean {
  if (!value || !value.trim()) return true
  const parts = value.trim().split('/')
  if (parts.length !== 3) return false
  const [dayString, monthString, yearString] = parts
  if (!/^\d{2}$/.test(dayString) || !/^\d{2}$/.test(monthString) || !/^\d{4}$/.test(yearString)) return false
  const day = Number(dayString)
  const month = Number(monthString)
  const year = Number(yearString)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > diasDelMes(month, year)) return false
  return true
}

export function getDateValidationError(value: string | null | undefined, touched = false): string | null {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()
  const parts = trimmed.split('/')

  if (parts[0] && parts[0].length === 2) {
    const day = Number(parts[0])
    if (!Number.isInteger(day) || day < 1 || day > 31) return 'Día inválido (01 al 31)'
  }

  if (parts[1] && parts[1].length === 2) {
    const month = Number(parts[1])
    if (!Number.isInteger(month) || month < 1 || month > 12) return 'Mes inválido (01 al 12)'
  }

  if (trimmed.length >= 10) {
    const [dayString, monthString, yearString] = parts
    if (!/^\d{4}$/.test(yearString)) return 'Año inválido (aaaa)'
    const day = Number(dayString)
    const month = Number(monthString)
    const year = Number(yearString)
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return 'Fecha inválida (dd/mm/aaaa)'
    }
    if (month < 1 || month > 12) return 'Mes inválido (01 al 12)'
    const diaMaximo = diasDelMes(month, year)
    if (day < 1 || day > diaMaximo) return `Día inexistente (${day}/${month}/${year})`
    if (!isValidDateString(trimmed)) return 'Fecha inválida (dd/mm/aaaa)'
  } else if (touched && trimmed.length > 0) {
    return 'Fecha incompleta (dd/mm/aaaa)'
  }

  return null
}

export function formatCuil(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`
}

export function extractDniFromCuil(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return ''
  if (digits.length <= 10) return digits.slice(2)
  return digits.slice(2, 10)
}

export function formatLettersOnly(value: string): string {
  if (!value) return ''
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
}

/**
 * Texto para nombres propios, juzgados y jueces: permite letras, espacios y
 * signos habituales (punto, coma, apóstrofo, guion y paréntesis), pero bloquea
 * números y símbolos raros. Se usa para las restricciones del formulario.
 */
export function formatLetrasSinNumeros(value: string): string {
  if (!value) return ''
  return value
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,'’()\-°º/]/g, '')
    .replace(/\s{2,}/g, ' ')
}

export function formatDigitsOnly(value: string): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function splitNombreCompleto(value: string | null | undefined): { apellido: string; nombre: string } {
  const parts = (value ?? '').trim().split(/\s+/)
  return { apellido: parts[0] ?? '', nombre: parts.slice(1).join(' ') }
}
