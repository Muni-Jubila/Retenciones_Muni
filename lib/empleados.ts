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

export interface FilaEmpleado {
  ID_DATOS_PERSONALES_AGENTE_JUBILA: number
  DNI_AGENTE: string | null
  CUIL: string | null
  NOMBRE_AGENTE: string
  APELLIDO_AGENTE: string
  SEGUNDO_NOMBRE_AGENTE: string | null
  SEGUNDO_APELLIDO_AGENTE: string | null
  SEXO: string | null
  FECHA_NACIMIENTO: Date
  ESTADO_ACTIVO: boolean
  SECRETARIA: string | null
  PROGRAMA: string | null
  CARGO: string | null
  NUMERO_TELEFONO: string | null
  CORREO_ELECTRONICO: string | null
  ANTIGUEDAD_RECIBO_CALC: string | null
  ANTIGUEDAD_LICENCIAS_CALC: string | null
  REGIMEN_JUBILATORIO: { NOMBRE_REGIMEN: string } | null
}

export function mapEmpleado(fila: FilaEmpleado): Empleado {
  const nombreCompleto = composeFullName({
    apellido: fila.APELLIDO_AGENTE,
    segundoApellido: fila.SEGUNDO_APELLIDO_AGENTE,
    nombre: fila.NOMBRE_AGENTE,
    segundoNombre: fila.SEGUNDO_NOMBRE_AGENTE,
  })

  return {
    id: fila.ID_DATOS_PERSONALES_AGENTE_JUBILA,
    dni: fila.DNI_AGENTE ?? '',
    cuil: fila.CUIL ?? '',
    apellido: fila.APELLIDO_AGENTE,
    segundoApellido: fila.SEGUNDO_APELLIDO_AGENTE ?? '',
    nombre: fila.NOMBRE_AGENTE,
    segundoNombre: fila.SEGUNDO_NOMBRE_AGENTE ?? '',
    nombreCompleto,
    sexo: fila.SEXO ?? '',
    fechaNacimiento: dbDateToStr(fila.FECHA_NACIMIENTO),
    edadActual: calcEdadActual(fila.FECHA_NACIMIENTO),
    estadoActivo: fila.ESTADO_ACTIVO,
    regimen: fila.REGIMEN_JUBILATORIO?.NOMBRE_REGIMEN ?? '',
    secretaria: fila.SECRETARIA ?? '',
    programa: fila.PROGRAMA ?? '',
    cargo: fila.CARGO ?? '',
    telefono: fila.NUMERO_TELEFONO ?? '',
    correo: fila.CORREO_ELECTRONICO ?? '',
    antiguedadRecibo: fila.ANTIGUEDAD_RECIBO_CALC ?? '',
    antiguedadLicencias: fila.ANTIGUEDAD_LICENCIAS_CALC ?? '',
  }
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
