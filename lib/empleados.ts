export interface Empleado {
  id: number
  dni: string
  cuil: string
  apellido: string
  segundoApellido: string
  nombre: string
  segundoNombre: string
  nombreCompleto: string
  sexo: string
  fechaNacimiento: string
  edadActual: string
  estadoActivo: boolean
  regimen: string
  secretaria: string
  programa: string
  cargo: string
  telefono: string
  correo: string
  antiguedadRecibo: string
  antiguedadLicencias: string
}

export function composeFullName(parts: {
  apellido?: string | null
  segundoApellido?: string | null
  nombre?: string | null
  segundoNombre?: string | null
}): string {
  return [parts.apellido, parts.segundoApellido, parts.nombre, parts.segundoNombre]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export function dbDateToStr(date: Date | null | undefined): string {
  if (!date) return ''
  const value = new Date(date)
  const day = String(value.getUTCDate()).padStart(2, '0')
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${value.getUTCFullYear()}`
}

export function calcEdadActual(fechaNacimiento: Date | null | undefined): string {
  if (!fechaNacimiento) return ''
  const today = new Date()
  const birth = new Date(fechaNacimiento)
  let age = today.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }
  return age >= 0 ? String(age) : ''
}
