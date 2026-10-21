export function formatDate(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function isValidDateString(value: string): boolean {
  if (!value || !value.trim()) return true
  const parts = value.trim().split('/')
  if (parts.length !== 3) return false
  const [dayString, monthString, yearString] = parts
  if (dayString.length !== 2 || monthString.length !== 2 || yearString.length !== 4) return false
  const day = Number(dayString)
  const month = Number(monthString)
  const year = Number(yearString)
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false
  if (year < 1900 || year > 3000) return false
  if (month < 1 || month > 12) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
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
    const day = Number(dayString)
    const month = Number(monthString)
    const year = Number(yearString)
    if (!Number.isInteger(year) || year < 1900 || year > 3000) return 'Año inválido (1900-3000)'
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (day < 1 || day > daysInMonth) return `Día inexistente (${day}/${month}/${year})`
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

export function formatDigitsOnly(value: string): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function splitNombreCompleto(value: string | null | undefined): { apellido: string; nombre: string } {
  const parts = (value ?? '').trim().split(/\s+/)
  return { apellido: parts[0] ?? '', nombre: parts.slice(1).join(' ') }
}
