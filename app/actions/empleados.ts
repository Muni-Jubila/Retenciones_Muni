'use server'

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { logServerError } from '@/lib/safe-error'
import { calcEdadActual, composeFullName, dbDateToStr, type Empleado } from '@/lib/empleados'
import { getDateValidationError } from '@/lib/format-utils'

interface FilaEmpleado {
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

function mapEmpleado(fila: FilaEmpleado): Empleado {
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

const includeRegimen = { REGIMEN_JUBILATORIO: true } as const

const ordenApellidoNombre = [
  { APELLIDO_AGENTE: 'asc' as const },
  { NOMBRE_AGENTE: 'asc' as const },
]

export async function buscarEmpleados(query: string): Promise<Empleado[]> {
  await requireAuthenticatedSession()

  const q = query.trim()

  try {
    if (!q) {
      const filas = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        where: { BIT_BORRADO: false },
        include: includeRegimen,
        orderBy: ordenApellidoNombre,
        take: 100,
      })
      return filas.map(mapEmpleado)
    }

    const cleanNumeric = q.replace(/[.\s-]/g, '')
    const isNumeric = /^\d+$/.test(cleanNumeric) && cleanNumeric.length > 0

    if (isNumeric) {
      const filas = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        where: {
          BIT_BORRADO: false,
          DNI_AGENTE: { contains: cleanNumeric },
        },
        include: includeRegimen,
        orderBy: { DNI_AGENTE: 'asc' },
        take: 50,
      })
      return filas.map(mapEmpleado)
    }

    const ids = await prisma.$queryRaw<{ id: number }[]>`
      SELECT "ID_DATOS_PERSONALES_AGENTE_JUBILA" AS id
      FROM "DATOS_PERSONALES_AGENTE_JUBILA"
      WHERE (unaccent("APELLIDO_AGENTE") ILIKE unaccent('%' || ${q} || '%')
         OR unaccent("NOMBRE_AGENTE") ILIKE unaccent('%' || ${q} || '%'))
        AND "BIT_BORRADO" = false
      ORDER BY "APELLIDO_AGENTE" ASC, "NOMBRE_AGENTE" ASC
      LIMIT 50
    `

    if (ids.length === 0) return []

    const filas = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
      where: {
        BIT_BORRADO: false,
        ID_DATOS_PERSONALES_AGENTE_JUBILA: { in: ids.map((fila) => fila.id) },
      },
      include: includeRegimen,
    })

    const porId = new Map(filas.map((fila) => [fila.ID_DATOS_PERSONALES_AGENTE_JUBILA, fila]))
    return ids
      .map((fila) => porId.get(fila.id))
      .filter((fila): fila is NonNullable<typeof fila> => Boolean(fila))
      .map(mapEmpleado)
  } catch (error) {
    logServerError('[buscarEmpleados] Error:', error)
    throw new Error('Error al buscar empleados en la base de datos.')
  }
}

export async function getUltimoEmpleado(): Promise<Empleado | null> {
  try {
    await requireAuthenticatedSession()
    const fila = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findFirst({
      where: { BIT_BORRADO: false },
      include: includeRegimen,
      orderBy: [
        { FECHA_ULTIMA_MODIFICACION: { sort: 'desc', nulls: 'last' } },
        { ID_DATOS_PERSONALES_AGENTE_JUBILA: 'desc' },
      ],
    })
    return fila ? mapEmpleado(fila) : null
  } catch (error) {
    logServerError('[getUltimoEmpleado] Error:', error)
    return null
  }
}

export interface EmpleadoUpdateInput {
  apellido: string
  segundoApellido: string
  nombre: string
  segundoNombre: string
  telefono: string
  correo: string
  fechaNacimiento: string
}

export interface ActualizarEmpleadoResult {
  ok: boolean
  error?: string
  field?: string
  empleado?: Empleado
}

function parseDate(value: string): Date | null {
  const parts = value.trim().split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export async function actualizarEmpleado(
  id: number,
  input: EmpleadoUpdateInput,
): Promise<ActualizarEmpleadoResult> {
  try {
    const session = await requireAuthenticatedSession()

    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: 'Empleado inválido.' }
    }

    const apellido = input.apellido.trim()
    const segundoApellido = input.segundoApellido.trim()
    const nombre = input.nombre.trim()
    const segundoNombre = input.segundoNombre.trim()
    const telefono = input.telefono.trim()
    const correo = input.correo.trim()

    if (!apellido) return { ok: false, error: 'El apellido es obligatorio.', field: 'apellido' }
    if (!nombre) return { ok: false, error: 'El nombre es obligatorio.', field: 'nombre' }
    if (apellido.length > 255) return { ok: false, error: 'El apellido es demasiado largo.', field: 'apellido' }
    if (nombre.length > 255) return { ok: false, error: 'El nombre es demasiado largo.', field: 'nombre' }
    if (telefono.length > 50) return { ok: false, error: 'El teléfono es demasiado largo.', field: 'telefono' }
    if (correo.length > 255) return { ok: false, error: 'El correo es demasiado largo.', field: 'correo' }

    const dateError = getDateValidationError(input.fechaNacimiento, true)
    if (dateError) {
      return { ok: false, error: dateError, field: 'fechaNacimiento' }
    }
    const fechaNacimiento = parseDate(input.fechaNacimiento)
    if (!fechaNacimiento) {
      return { ok: false, error: 'La fecha de nacimiento es obligatoria.', field: 'fechaNacimiento' }
    }

    const fila = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
      where: { ID_DATOS_PERSONALES_AGENTE_JUBILA: id },
      data: {
        APELLIDO_AGENTE: apellido,
        SEGUNDO_APELLIDO_AGENTE: segundoApellido || null,
        NOMBRE_AGENTE: nombre,
        SEGUNDO_NOMBRE_AGENTE: segundoNombre || null,
        NUMERO_TELEFONO: telefono || null,
        CORREO_ELECTRONICO: correo || null,
        FECHA_NACIMIENTO: fechaNacimiento,
        FECHA_ULTIMA_MODIFICACION: new Date(),
        USUARIO_ULTIMA_MODIFICACION: session.userId,
      },
      include: includeRegimen,
    })

    return { ok: true, empleado: mapEmpleado(fila) }
  } catch (error) {
    logServerError('[actualizarEmpleado] Error:', error)
    return { ok: false, error: 'No se pudieron guardar los cambios del empleado.' }
  }
}
