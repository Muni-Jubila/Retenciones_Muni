'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { isEmbargosMock } from '@/lib/mock-mode'
import * as mock from '@/lib/embargos-mock'
import { logServerError } from '@/lib/safe-error'
import { composeFullName, dbDateToStr } from '@/lib/empleados'
import { getDateValidationError } from '@/lib/format-utils'
import {
  ESTADOS_EMBARGO,
  periodoActual,
  periodoLabel,
  parseMoneyInput,
  roundMoney,
  toCsv,
  type ConsultaEmbargosFiltros,
  type Embargo,
  type EmbargoInput,
  type EstadoEmbargo,
  type ResumenRetencion,
  type RetencionEmbargo,
  type RetencionInput,
} from '@/lib/embargos'

const includeEmbargo = {
  DATOS_PERSONALES_AGENTE_JUBILA: {
    select: {
      DNI_AGENTE: true,
      APELLIDO_AGENTE: true,
      SEGUNDO_APELLIDO_AGENTE: true,
      NOMBRE_AGENTE: true,
      SEGUNDO_NOMBRE_AGENTE: true,
      PROGRAMA: true,
      SECRETARIA: true,
      CARGO: true,
    },
  },
  RETENCION_EMBARGO: {
    orderBy: { PERIODO: 'asc' as const },
  },
} as const

type EmbargoDb = Prisma.EMBARGOGetPayload<{ include: typeof includeEmbargo }>
type RetencionDb = Prisma.RETENCION_EMBARGOGetPayload<Record<string, never>>

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(roundMoney(value).toFixed(2))
}

function parseDate(value: string): Date | null {
  const parts = value.trim().split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function mapRetencion(fila: RetencionDb): RetencionEmbargo {
  return {
    id: fila.ID_RETENCION,
    idEmbargo: fila.ID_EMBARGO,
    periodo: fila.PERIODO,
    sueldo: Number(fila.SUELDO),
    refrigerio: Number(fila.REFRIGERIO),
    retencionMensual: Number(fila.RETENCION_MENSUAL),
    saldo: Number(fila.SALDO),
    devolucion: Number(fila.DEVOLUCION),
    observaciones: fila.OBSERVACIONES ?? '',
    fechaRegistro: dbDateToStr(fila.FECHA_REGISTRO),
  }
}

function mapEmbargo(fila: EmbargoDb): Embargo {
  const retenciones = [...fila.RETENCION_EMBARGO].sort((a, b) => a.PERIODO.localeCompare(b.PERIODO))
  const deuda = Number(fila.DEUDA)
  const totalRetenido = roundMoney(
    retenciones.reduce((acc, item) => acc + Number(item.RETENCION_MENSUAL), 0),
  )
  const totalDevuelto = roundMoney(
    retenciones.reduce((acc, item) => acc + Number(item.DEVOLUCION), 0),
  )
  const ultima = retenciones[retenciones.length - 1]
  const saldoActual = ultima
    ? Number(ultima.SALDO)
    : roundMoney(deuda - totalRetenido + totalDevuelto)

  return {
    id: fila.ID_EMBARGO,
    idAgente: fila.ID_AGENTE,
    dni: fila.DATOS_PERSONALES_AGENTE_JUBILA.DNI_AGENTE ?? '',
    agente: composeFullName({
      apellido: fila.DATOS_PERSONALES_AGENTE_JUBILA.APELLIDO_AGENTE,
      segundoApellido: fila.DATOS_PERSONALES_AGENTE_JUBILA.SEGUNDO_APELLIDO_AGENTE,
      nombre: fila.DATOS_PERSONALES_AGENTE_JUBILA.NOMBRE_AGENTE,
      segundoNombre: fila.DATOS_PERSONALES_AGENTE_JUBILA.SEGUNDO_NOMBRE_AGENTE,
    }),
    estado: (fila.ESTADO as EstadoEmbargo) ?? 'ESPERA',
    autos: fila.AUTOS ?? '',
    expediente: fila.EXPEDIENTE ?? '',
    fechaExpediente: dbDateToStr(fila.FECHA_EXPEDIENTE),
    cuenta: fila.CUENTA ?? '',
    sucursal: fila.SUCURSAL ?? '',
    juez: fila.JUEZ ?? '',
    instancia: fila.INSTANCIA ?? '',
    nomenclatura: fila.NOMENCLATURA ?? '',
    tipoProceso: fila.TIPO_PROCESO ?? '',
    secretaria: fila.SECRETARIA ?? '',
    deuda,
    importeMensual: Number(fila.IMPORTE_MENSUAL),
    porcentaje: Number(fila.PORCENTAJE ?? 0),
    marcaEspecial: fila.MARCA_ESPECIAL ?? '',
    observaciones: fila.OBSERVACIONES ?? '',
    fechaAlta: dbDateToStr(fila.FECHA_ALTA),
    fechaBaja: dbDateToStr(fila.FECHA_BAJA),
    motivoBaja: fila.MOTIVO_BAJA ?? '',
    saldoActual,
    totalRetenido,
    totalDevuelto,
    cantidadRetenciones: retenciones.length,
    primerPeriodo: retenciones[0]?.PERIODO ?? '',
    ultimoPeriodo: ultima?.PERIODO ?? '',
    programa: fila.DATOS_PERSONALES_AGENTE_JUBILA.PROGRAMA ?? '',
    secretariaAgente: fila.DATOS_PERSONALES_AGENTE_JUBILA.SECRETARIA ?? '',
    cargo: fila.DATOS_PERSONALES_AGENTE_JUBILA.CARGO ?? '',
  }
}

function validarEstado(estado: string): EstadoEmbargo | null {
  const found = ESTADOS_EMBARGO.find((item) => item.value === estado)
  return found ? found.value : null
}

function validarEmbargo(input: EmbargoInput): { error?: string; field?: string } {
  if (!Number.isInteger(input.idAgente) || input.idAgente <= 0) {
    return { error: 'Seleccione un agente válido.', field: 'idAgente' }
  }
  if (!validarEstado(input.estado)) {
    return { error: 'El estado del embargo no es válido.', field: 'estado' }
  }
  if (input.autos.trim().length > 500) return { error: 'Los autos superan los 500 caracteres.', field: 'autos' }
  if (input.expediente.trim().length > 100) return { error: 'El expediente supera los 100 caracteres.', field: 'expediente' }
  if (input.cuenta.trim().length > 100) return { error: 'La cuenta supera los 100 caracteres.', field: 'cuenta' }
  if (input.sucursal.trim().length > 50) return { error: 'La sucursal supera los 50 caracteres.', field: 'sucursal' }
  if (input.juez.trim().length > 255) return { error: 'El juzgado supera los 255 caracteres.', field: 'juez' }
  if (input.secretaria.trim().length > 100) return { error: 'La secretaría supera los 100 caracteres.', field: 'secretaria' }
  if (input.observaciones.trim().length > 1000) return { error: 'Las observaciones superan los 1000 caracteres.', field: 'observaciones' }

  const fechaError = getDateValidationError(input.fechaExpediente, true)
  if (fechaError) return { error: fechaError, field: 'fechaExpediente' }

  const deuda = parseMoneyInput(input.deuda)
  if (deuda < 0) return { error: 'La deuda no puede ser negativa.', field: 'deuda' }
  const importe = parseMoneyInput(input.importeMensual)
  if (importe < 0) return { error: 'El importe mensual no puede ser negativo.', field: 'importeMensual' }
  const porcentaje = parseMoneyInput(input.porcentaje)
  if (porcentaje < 0 || porcentaje > 100) {
    return { error: 'El porcentaje debe estar entre 0 y 100.', field: 'porcentaje' }
  }

  return {}
}

function buildEmbargoData(input: EmbargoInput) {
  return {
    ESTADO: validarEstado(input.estado) ?? 'ESPERA',
    AUTOS: input.autos.trim() || null,
    EXPEDIENTE: input.expediente.trim() || null,
    FECHA_EXPEDIENTE: input.fechaExpediente.trim() ? parseDate(input.fechaExpediente) : null,
    CUENTA: input.cuenta.trim() || null,
    SUCURSAL: input.sucursal.trim() || null,
    JUEZ: input.juez.trim() || null,
    INSTANCIA: input.instancia.trim() || null,
    NOMENCLATURA: input.nomenclatura.trim() || null,
    TIPO_PROCESO: input.tipoProceso.trim() || null,
    SECRETARIA: input.secretaria.trim() || null,
    DEUDA: decimal(parseMoneyInput(input.deuda)),
    IMPORTE_MENSUAL: decimal(parseMoneyInput(input.importeMensual)),
    PORCENTAJE: input.porcentaje.trim() ? decimal(parseMoneyInput(input.porcentaje)) : null,
    MARCA_ESPECIAL: input.marcaEspecial.trim() || null,
    OBSERVACIONES: input.observaciones.trim() || null,
  }
}

/**
 * Recalcula el saldo de todas las retenciones de un embargo en orden cronológico.
 * El saldo inicial es la deuda y se descuenta cada retención, sumando devoluciones.
 */
async function recalcularSaldos(idEmbargo: number): Promise<number | null> {
  const embargo = await prisma.eMBARGO.findUnique({
    where: { ID_EMBARGO: idEmbargo },
    include: { RETENCION_EMBARGO: { orderBy: { PERIODO: 'asc' } } },
  })
  if (!embargo) return null

  let saldo = Number(embargo.DEUDA)
  for (const retencion of embargo.RETENCION_EMBARGO) {
    saldo = roundMoney(saldo - Number(retencion.RETENCION_MENSUAL) + Number(retencion.DEVOLUCION))
    if (Number(retencion.SALDO) !== saldo) {
      await prisma.rETENCION_EMBARGO.update({
        where: { ID_RETENCION: retencion.ID_RETENCION },
        data: { SALDO: decimal(saldo) },
      })
    }
  }

  if (saldo <= 0 && (embargo.ESTADO === 'ACTIVO' || embargo.ESTADO === 'ESPERA')) {
    await prisma.eMBARGO.update({
      where: { ID_EMBARGO: idEmbargo },
      data: {
        ESTADO: 'CANCELADO',
        FECHA_BAJA: new Date(),
        MOTIVO_BAJA: 'Deuda cancelada',
      },
    })
  } else if (saldo > 0 && embargo.ESTADO === 'CANCELADO' && embargo.MOTIVO_BAJA === 'Deuda cancelada') {
    // Si se eliminó o corrigió una retención, la deuda vuelve a estar pendiente.
    await prisma.eMBARGO.update({
      where: { ID_EMBARGO: idEmbargo },
      data: {
        ESTADO: 'ACTIVO',
        FECHA_BAJA: null,
        MOTIVO_BAJA: null,
      },
    })
  }

  return saldo
}

export interface EmbargoActionResult {
  ok: boolean
  error?: string
  field?: string
  embargo?: Embargo
}

export interface RetencionActionResult {
  ok: boolean
  error?: string
  field?: string
  retencion?: RetencionEmbargo
  saldoActual?: number
}

export async function listarEmbargosDeAgente(idAgente: number): Promise<Embargo[]> {
  if (isEmbargosMock()) {
    const { getEmpleadoPorId } = await import('@/app/actions/empleados')
    const empleado = await getEmpleadoPorId(idAgente)
    return mock.listarEmbargosDeAgente(idAgente, empleado)
  }
  try {
    await requireAuthenticatedSession()
    if (!Number.isInteger(idAgente) || idAgente <= 0) return []
    const filas = await prisma.eMBARGO.findMany({
      where: { ID_AGENTE: idAgente, BIT_BORRADO: false },
      include: includeEmbargo,
      orderBy: [{ FECHA_ALTA: 'desc' }, { ID_EMBARGO: 'desc' }],
    })
    return filas.map(mapEmbargo)
  } catch (error) {
    logServerError('[listarEmbargosDeAgente] Error:', error)
    throw new Error('No se pudieron cargar los embargos del agente.')
  }
}

export async function crearEmbargo(input: EmbargoInput): Promise<EmbargoActionResult> {
  if (isEmbargosMock()) return mock.crearEmbargo(input) as any
  try {
    const session = await requireAuthenticatedSession()
    const validation = validarEmbargo(input)
    if (validation.error) return { ok: false, error: validation.error, field: validation.field }

    const agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findFirst({
      where: { ID_DATOS_PERSONALES_AGENTE_JUBILA: input.idAgente, BIT_BORRADO: false },
      select: { ID_DATOS_PERSONALES_AGENTE_JUBILA: true },
    })
    if (!agente) return { ok: false, error: 'El agente no existe o está dado de baja.' }

    const expediente = input.expediente.trim()
    if (expediente) {
      const duplicado = await prisma.eMBARGO.findFirst({
        where: {
          ID_AGENTE: input.idAgente,
          EXPEDIENTE: expediente,
          BIT_BORRADO: false,
        },
        select: { ID_EMBARGO: true },
      })
      if (duplicado) {
        return {
          ok: false,
          error: 'Ya existe un embargo con ese expediente para este agente.',
          field: 'expediente',
        }
      }
    }

    const estadoNuevo = validarEstado(input.estado) ?? 'ESPERA'
    const cierraAlCrear = estadoNuevo === 'BAJA' || estadoNuevo === 'CANCELADO'
    const creado = await prisma.eMBARGO.create({
      data: {
        ID_AGENTE: input.idAgente,
        ...buildEmbargoData(input),
        FECHA_ALTA: new Date(),
        FECHA_BAJA: cierraAlCrear ? new Date() : null,
        MOTIVO_BAJA: cierraAlCrear ? `Creado como ${estadoNuevo.toLowerCase()}` : null,
        USUARIO_CREACION: session.userId,
      },
      include: includeEmbargo,
    })

    return { ok: true, embargo: mapEmbargo(creado) }
  } catch (error) {
    logServerError('[crearEmbargo] Error:', error)
    return { ok: false, error: 'No se pudo guardar el embargo.' }
  }
}

export async function actualizarEmbargo(id: number, input: EmbargoInput): Promise<EmbargoActionResult> {
  if (isEmbargosMock()) return mock.actualizarEmbargo(id, input) as any
  try {
    const session = await requireAuthenticatedSession()
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Embargo inválido.' }

    const validation = validarEmbargo(input)
    if (validation.error) return { ok: false, error: validation.error, field: validation.field }

    const actual = await prisma.eMBARGO.findFirst({
      where: { ID_EMBARGO: id, BIT_BORRADO: false },
      select: { ID_EMBARGO: true, ID_AGENTE: true, DEUDA: true, ESTADO: true },
    })
    if (!actual) return { ok: false, error: 'El embargo no existe o fue eliminado.' }

    const expediente = input.expediente.trim()
    if (expediente) {
      const duplicado = await prisma.eMBARGO.findFirst({
        where: {
          ID_AGENTE: actual.ID_AGENTE,
          EXPEDIENTE: expediente,
          BIT_BORRADO: false,
          ID_EMBARGO: { not: id },
        },
        select: { ID_EMBARGO: true },
      })
      if (duplicado) {
        return {
          ok: false,
          error: 'Ya existe otro embargo con ese expediente para este agente.',
          field: 'expediente',
        }
      }
    }

    const estadoAnterior = actual.ESTADO
    const nuevoEstado = validarEstado(input.estado) ?? 'ESPERA'
    const data: Prisma.EMBARGOUpdateInput = {
      ...buildEmbargoData(input),
      FECHA_ULTIMA_MODIFICACION: new Date(),
      USUARIO_ULTIMA_MODIFICACION: session.userId,
    }

    if (nuevoEstado === 'BAJA' || nuevoEstado === 'CANCELADO') {
      data.FECHA_BAJA = new Date()
      data.MOTIVO_BAJA = `Cambio de estado a ${nuevoEstado.toLowerCase()}`
    } else {
      data.FECHA_BAJA = null
      if (estadoAnterior === 'BAJA' || estadoAnterior === 'CANCELADO') {
        data.MOTIVO_BAJA = null
      }
    }

    const actualizado = await prisma.eMBARGO.update({
      where: { ID_EMBARGO: id },
      data,
      include: includeEmbargo,
    })

    // Si cambió la deuda, los saldos históricos deben recalcularse.
    if (Number(actual.DEUDA) !== Number(actualizado.DEUDA)) {
      await recalcularSaldos(id)
      const recargado = await prisma.eMBARGO.findUniqueOrThrow({
        where: { ID_EMBARGO: id },
        include: includeEmbargo,
      })
      return { ok: true, embargo: mapEmbargo(recargado) }
    }

    return { ok: true, embargo: mapEmbargo(actualizado) }
  } catch (error) {
    logServerError('[actualizarEmbargo] Error:', error)
    return { ok: false, error: 'No se pudieron guardar los cambios del embargo.' }
  }
}

export async function cambiarEstadoEmbargo(
  id: number,
  estado: string,
  motivo?: string,
): Promise<EmbargoActionResult> {
  if (isEmbargosMock()) return mock.cambiarEstadoEmbargo(id, estado, motivo) as any
  try {
    const session = await requireAuthenticatedSession()
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Embargo inválido.' }
    const nuevoEstado = validarEstado(estado)
    if (!nuevoEstado) return { ok: false, error: 'Estado de embargo inválido.' }

    const actual = await prisma.eMBARGO.findFirst({
      where: { ID_EMBARGO: id, BIT_BORRADO: false },
      select: { ID_EMBARGO: true },
    })
    if (!actual) return { ok: false, error: 'El embargo no existe o fue eliminado.' }

    const cierra = nuevoEstado === 'BAJA' || nuevoEstado === 'CANCELADO'
    const actualizado = await prisma.eMBARGO.update({
      where: { ID_EMBARGO: id },
      data: {
        ESTADO: nuevoEstado,
        FECHA_BAJA: cierra ? new Date() : null,
        MOTIVO_BAJA: cierra ? motivo?.trim() || `Cambio de estado a ${nuevoEstado.toLowerCase()}` : null,
        FECHA_ULTIMA_MODIFICACION: new Date(),
        USUARIO_ULTIMA_MODIFICACION: session.userId,
      },
      include: includeEmbargo,
    })

    return { ok: true, embargo: mapEmbargo(actualizado) }
  } catch (error) {
    logServerError('[cambiarEstadoEmbargo] Error:', error)
    return { ok: false, error: 'No se pudo cambiar el estado del embargo.' }
  }
}

export async function eliminarEmbargo(id: number): Promise<{ ok: boolean; error?: string }> {
  if (isEmbargosMock()) return mock.eliminarEmbargo(id)
  try {
    const session = await requireAuthenticatedSession()
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Embargo inválido.' }

    const actual = await prisma.eMBARGO.findFirst({
      where: { ID_EMBARGO: id, BIT_BORRADO: false },
      select: { ID_EMBARGO: true },
    })
    if (!actual) return { ok: false, error: 'El embargo no existe o ya fue eliminado.' }

    await prisma.eMBARGO.update({
      where: { ID_EMBARGO: id },
      data: {
        BIT_BORRADO: true,
        FECHA_BAJA: new Date(),
        FECHA_ULTIMA_MODIFICACION: new Date(),
        USUARIO_ULTIMA_MODIFICACION: session.userId,
      },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[eliminarEmbargo] Error:', error)
    return { ok: false, error: 'No se pudo eliminar el embargo.' }
  }
}

export async function listarRetenciones(idEmbargo: number): Promise<RetencionEmbargo[]> {
  if (isEmbargosMock()) return mock.listarRetenciones(idEmbargo)
  try {
    await requireAuthenticatedSession()
    if (!Number.isInteger(idEmbargo) || idEmbargo <= 0) return []
    const filas = await prisma.rETENCION_EMBARGO.findMany({
      where: { ID_EMBARGO: idEmbargo },
      orderBy: { PERIODO: 'asc' },
    })
    return filas.map(mapRetencion)
  } catch (error) {
    logServerError('[listarRetenciones] Error:', error)
    throw new Error('No se pudieron cargar las retenciones.')
  }
}

function validarPeriodo(periodo: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo.trim())
}

export async function crearRetencion(input: RetencionInput): Promise<RetencionActionResult> {
  if (isEmbargosMock()) return mock.crearRetencion(input) as any
  try {
    const session = await requireAuthenticatedSession()
    if (!Number.isInteger(input.idEmbargo) || input.idEmbargo <= 0) {
      return { ok: false, error: 'Embargo inválido.' }
    }
    const periodo = input.periodo.trim()
    if (!validarPeriodo(periodo)) return { ok: false, error: 'Período inválido (usar aaaa-mm).', field: 'periodo' }

    const embargo = await prisma.eMBARGO.findFirst({
      where: { ID_EMBARGO: input.idEmbargo, BIT_BORRADO: false },
      include: { RETENCION_EMBARGO: { orderBy: { PERIODO: 'asc' } } },
    })
    if (!embargo) return { ok: false, error: 'El embargo no existe o fue eliminado.' }

    const existente = embargo.RETENCION_EMBARGO.find((item) => item.PERIODO === periodo)
    if (existente) {
      return { ok: false, error: `Ya existe una retención para ${periodoLabel(periodo)}.`, field: 'periodo' }
    }

    const retencion = parseMoneyInput(input.retencionMensual)
    const devolucion = parseMoneyInput(input.devolucion)
    if (retencion < 0) return { ok: false, error: 'La retención no puede ser negativa.', field: 'retencionMensual' }
    if (devolucion < 0) return { ok: false, error: 'La devolución no puede ser negativa.', field: 'devolucion' }
    if (retencion === 0 && devolucion === 0) {
      return { ok: false, error: 'Ingrese una retención o una devolución.', field: 'retencionMensual' }
    }

    const saldoPrevio = roundMoney(
      embargo.RETENCION_EMBARGO.filter((item) => item.PERIODO < periodo).reduce(
        (acc, item) => acc - Number(item.RETENCION_MENSUAL) + Number(item.DEVOLUCION),
        Number(embargo.DEUDA),
      ),
    )
    if (retencion > saldoPrevio + devolucion) {
      return {
        ok: false,
        error: `La retención supera el saldo disponible (${saldoPrevio.toFixed(2)}).`,
        field: 'retencionMensual',
      }
    }

    const saldo = roundMoney(saldoPrevio - retencion + devolucion)

    const creada = await prisma.rETENCION_EMBARGO.create({
      data: {
        ID_EMBARGO: input.idEmbargo,
        PERIODO: periodo,
        SUELDO: decimal(parseMoneyInput(input.sueldo)),
        REFRIGERIO: decimal(parseMoneyInput(input.refrigerio)),
        RETENCION_MENSUAL: decimal(retencion),
        DEVOLUCION: decimal(devolucion),
        SALDO: decimal(saldo),
        OBSERVACIONES: input.observaciones.trim() || null,
        USUARIO_CREACION: session.userId,
      },
    })

    const saldoFinal = await recalcularSaldos(input.idEmbargo)
    return { ok: true, retencion: mapRetencion(creada), saldoActual: saldoFinal ?? saldo }
  } catch (error) {
    logServerError('[crearRetencion] Error:', error)
    return { ok: false, error: 'No se pudo registrar la retención.' }
  }
}

export async function actualizarRetencion(
  id: number,
  input: Omit<RetencionInput, 'idEmbargo'>,
): Promise<RetencionActionResult> {
  if (isEmbargosMock()) return mock.actualizarRetencion(id, input) as any
  try {
    await requireAuthenticatedSession()
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Retención inválida.' }
    const periodo = input.periodo.trim()
    if (!validarPeriodo(periodo)) return { ok: false, error: 'Período inválido (usar aaaa-mm).', field: 'periodo' }

    const actual = await prisma.rETENCION_EMBARGO.findUnique({ where: { ID_RETENCION: id } })
    if (!actual) return { ok: false, error: 'La retención no existe.' }

    const duplicado = await prisma.rETENCION_EMBARGO.findFirst({
      where: {
        ID_EMBARGO: actual.ID_EMBARGO,
        PERIODO: periodo,
        ID_RETENCION: { not: id },
      },
      select: { ID_RETENCION: true },
    })
    if (duplicado) {
      return { ok: false, error: `Ya existe una retención para ${periodoLabel(periodo)}.`, field: 'periodo' }
    }

    const retencion = parseMoneyInput(input.retencionMensual)
    const devolucion = parseMoneyInput(input.devolucion)
    if (retencion < 0) return { ok: false, error: 'La retención no puede ser negativa.', field: 'retencionMensual' }
    if (devolucion < 0) return { ok: false, error: 'La devolución no puede ser negativa.', field: 'devolucion' }
    if (retencion === 0 && devolucion === 0) {
      return { ok: false, error: 'Ingrese una retención o una devolución.', field: 'retencionMensual' }
    }

    const embargo = await prisma.eMBARGO.findUnique({
      where: { ID_EMBARGO: actual.ID_EMBARGO },
      include: { RETENCION_EMBARGO: { orderBy: { PERIODO: 'asc' } } },
    })
    if (!embargo) return { ok: false, error: 'El embargo asociado no existe.' }

    const saldoPrevio = roundMoney(
      embargo.RETENCION_EMBARGO.filter((item) => item.PERIODO < periodo && item.ID_RETENCION !== id).reduce(
        (acc, item) => acc - Number(item.RETENCION_MENSUAL) + Number(item.DEVOLUCION),
        Number(embargo.DEUDA),
      ),
    )
    if (retencion > saldoPrevio + devolucion) {
      return {
        ok: false,
        error: `La retención supera el saldo disponible (${saldoPrevio.toFixed(2)}).`,
        field: 'retencionMensual',
      }
    }

    const saldo = roundMoney(saldoPrevio - retencion + devolucion)
    const actualizada = await prisma.rETENCION_EMBARGO.update({
      where: { ID_RETENCION: id },
      data: {
        PERIODO: periodo,
        SUELDO: decimal(parseMoneyInput(input.sueldo)),
        REFRIGERIO: decimal(parseMoneyInput(input.refrigerio)),
        RETENCION_MENSUAL: decimal(retencion),
        DEVOLUCION: decimal(devolucion),
        SALDO: decimal(saldo),
        OBSERVACIONES: input.observaciones.trim() || null,
      },
    })

    const saldoFinal = await recalcularSaldos(actual.ID_EMBARGO)
    return { ok: true, retencion: mapRetencion(actualizada), saldoActual: saldoFinal ?? saldo }
  } catch (error) {
    logServerError('[actualizarRetencion] Error:', error)
    return { ok: false, error: 'No se pudo actualizar la retención.' }
  }
}

export async function eliminarRetencion(id: number): Promise<{ ok: boolean; error?: string; saldoActual?: number }> {
  if (isEmbargosMock()) return mock.eliminarRetencion(id)
  try {
    await requireAuthenticatedSession()
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Retención inválida.' }
    const actual = await prisma.rETENCION_EMBARGO.findUnique({
      where: { ID_RETENCION: id },
      select: { ID_RETENCION: true, ID_EMBARGO: true },
    })
    if (!actual) return { ok: false, error: 'La retención no existe.' }

    await prisma.rETENCION_EMBARGO.delete({ where: { ID_RETENCION: id } })
    const saldoFinal = await recalcularSaldos(actual.ID_EMBARGO)
    return { ok: true, saldoActual: saldoFinal ?? undefined }
  } catch (error) {
    logServerError('[eliminarRetencion] Error:', error)
    return { ok: false, error: 'No se pudo eliminar la retención.' }
  }
}

function buildConsultaWhere(filtros: ConsultaEmbargosFiltros): Prisma.EMBARGOWhereInput {
  const where: Prisma.EMBARGOWhereInput = { BIT_BORRADO: false }
  const condiciones: Prisma.EMBARGOWhereInput[] = []
  const texto = (filtros.texto ?? '').trim()
  const tipo = filtros.tipo ?? 'TODAS'
  const hace30Dias = new Date()
  hace30Dias.setDate(hace30Dias.getDate() - 30)

  const dnis = (filtros.dnis ?? [])
    .map((dni) => dni.replace(/\D/g, ''))
    .filter((dni) => dni.length > 0)
  if (dnis.length > 0) {
    condiciones.push({ DATOS_PERSONALES_AGENTE_JUBILA: { DNI_AGENTE: { in: [...new Set(dnis)] } } })
  }

  if (filtros.estado && validarEstado(filtros.estado)) {
    condiciones.push({ ESTADO: filtros.estado })
  }
  if (filtros.periodo && validarPeriodo(filtros.periodo)) {
    condiciones.push({ RETENCION_EMBARGO: { some: { PERIODO: filtros.periodo } } })
  }

  switch (tipo) {
    case 'AGENTE':
      if (texto) {
        const digits = texto.replace(/[.\s-]/g, '')
        condiciones.push({
          OR: [
            { DATOS_PERSONALES_AGENTE_JUBILA: { DNI_AGENTE: { contains: digits } } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { APELLIDO_AGENTE: { contains: texto, mode: 'insensitive' } } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { SEGUNDO_APELLIDO_AGENTE: { contains: texto, mode: 'insensitive' } } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { NOMBRE_AGENTE: { contains: texto, mode: 'insensitive' } } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { SEGUNDO_NOMBRE_AGENTE: { contains: texto, mode: 'insensitive' } } },
          ],
        })
      }
      break
    case 'PROGRAMA':
      if (texto) {
        condiciones.push({
          DATOS_PERSONALES_AGENTE_JUBILA: { PROGRAMA: { contains: texto, mode: 'insensitive' } },
        })
      }
      break
    case 'EXPEDIENTE':
      if (texto) condiciones.push({ EXPEDIENTE: { contains: texto, mode: 'insensitive' } })
      break
    case 'CANCELACIONES':
      condiciones.push({ ESTADO: 'CANCELADO' })
      break
    case 'DEVOLUCIONES':
      condiciones.push({ RETENCION_EMBARGO: { some: { DEVOLUCION: { gt: 0 } } } })
      break
    case 'NO_IMPUTACIONES':
      condiciones.push({ ESTADO: 'ESPERA' }, { RETENCION_EMBARGO: { none: {} } })
      break
    case 'ALTAS':
      condiciones.push({ FECHA_ALTA: { gte: hace30Dias } })
      break
    case 'BAJAS_COBRANDO':
    case 'BAJAS_REN_DEC':
      condiciones.push({ ESTADO: 'BAJA' })
      if (tipo === 'BAJAS_REN_DEC') {
        condiciones.push({
          OR: [
            { MOTIVO_BAJA: { contains: 'renuncia', mode: 'insensitive' } },
            { MOTIVO_BAJA: { contains: 'decreto', mode: 'insensitive' } },
          ],
        })
      }
      if (texto) {
        condiciones.push({
          OR: [
            { EXPEDIENTE: { contains: texto, mode: 'insensitive' } },
            { AUTOS: { contains: texto, mode: 'insensitive' } },
            { MOTIVO_BAJA: { contains: texto, mode: 'insensitive' } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { APELLIDO_AGENTE: { contains: texto, mode: 'insensitive' } } },
          ],
        })
      }
      break
    case 'ACTIVOS_SIN_RETENCION':
      condiciones.push({ ESTADO: 'ACTIVO' }, { RETENCION_EMBARGO: { none: {} } })
      break
    case 'PRIMER_MES':
      condiciones.push({ RETENCION_EMBARGO: { some: {} } })
      break
    default:
      if (texto) {
        condiciones.push({
          OR: [
            { EXPEDIENTE: { contains: texto, mode: 'insensitive' } },
            { AUTOS: { contains: texto, mode: 'insensitive' } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { DNI_AGENTE: { contains: texto.replace(/[.\s-]/g, '') } } },
            { DATOS_PERSONALES_AGENTE_JUBILA: { APELLIDO_AGENTE: { contains: texto, mode: 'insensitive' } } },
          ],
        })
      }
      break
  }

  if (condiciones.length > 0) where.AND = condiciones
  return where
}

export async function consultarEmbargos(filtros: ConsultaEmbargosFiltros): Promise<Embargo[]> {
  const dnis = [...new Set((filtros.dnis ?? [])
    .map((dni) => dni.replace(/\D/g, ''))
    .filter((dni) => dni.length > 0))]
  filtros = { ...filtros, dnis }
  // Las consultas no deben devolver información personal ni embargos sin una búsqueda explícita por DNI.
  if (isEmbargosMock()) return dnis.length > 0 ? mock.consultarEmbargos(filtros) : []
  try {
    await requireAuthenticatedSession()
    if (dnis.length === 0) return []
    const filas = await prisma.eMBARGO.findMany({
      where: buildConsultaWhere(filtros),
      include: includeEmbargo,
      // Del más viejo al más nuevo.
      orderBy: [{ FECHA_ALTA: 'asc' }, { ID_EMBARGO: 'asc' }],
      take: 300,
    })
    const embargos = filas.map(mapEmbargo)

    // Filtros que dependen de importes calculados (saldo) se resuelven en memoria.
    const tipo = filtros.tipo ?? 'TODAS'
    if (tipo === 'BAJAS_COBRANDO') {
      return embargos.filter((item) => item.saldoActual > 0)
    }
    if (tipo === 'PRIMER_MES' && filtros.periodo && validarPeriodo(filtros.periodo)) {
      return embargos.filter((item) => item.primerPeriodo === filtros.periodo)
    }
    return embargos
  } catch (error) {
    logServerError('[consultarEmbargos] Error:', error)
    throw new Error('No se pudo ejecutar la consulta de embargos.')
  }
}

export interface ActualizacionMasivaResult {
  ok: boolean
  error?: string
  procesados: number
  activados: number
  cancelados: number
  ajustados: number
}

export async function actualizarEsperas(): Promise<ActualizacionMasivaResult> {
  if (isEmbargosMock()) return mock.actualizarEsperas() as any
  try {
    const session = await requireAuthenticatedSession()
    const embargos = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false, ESTADO: { in: ['ESPERA', 'ACTIVO'] } },
      include: { RETENCION_EMBARGO: { orderBy: { PERIODO: 'asc' } } },
    })

    let activados = 0
    let cancelados = 0
    let ajustados = 0

    for (const embargo of embargos) {
      const saldo = roundMoney(
        embargo.RETENCION_EMBARGO.reduce(
          (acc, item) => acc - Number(item.RETENCION_MENSUAL) + Number(item.DEVOLUCION),
          Number(embargo.DEUDA),
        ),
      )
      const ultimaRetencion = embargo.RETENCION_EMBARGO[embargo.RETENCION_EMBARGO.length - 1]
      if (ultimaRetencion && Number(ultimaRetencion.SALDO) !== saldo) ajustados += 1

      if (saldo <= 0) {
        await prisma.eMBARGO.update({
          where: { ID_EMBARGO: embargo.ID_EMBARGO },
          data: {
            ESTADO: 'CANCELADO',
            FECHA_BAJA: new Date(),
            MOTIVO_BAJA: 'Deuda cancelada',
            FECHA_ULTIMA_MODIFICACION: new Date(),
            USUARIO_ULTIMA_MODIFICACION: session.userId,
          },
        })
        cancelados += 1
      } else if (embargo.ESTADO === 'ESPERA' && embargo.RETENCION_EMBARGO.length > 0) {
        await prisma.eMBARGO.update({
          where: { ID_EMBARGO: embargo.ID_EMBARGO },
          data: {
            ESTADO: 'ACTIVO',
            FECHA_BAJA: null,
            MOTIVO_BAJA: null,
            FECHA_ULTIMA_MODIFICACION: new Date(),
            USUARIO_ULTIMA_MODIFICACION: session.userId,
          },
        })
        activados += 1
      }

      await recalcularSaldos(embargo.ID_EMBARGO)
    }

    return { ok: true, procesados: embargos.length, activados, cancelados, ajustados }
  } catch (error) {
    logServerError('[actualizarEsperas] Error:', error)
    return {
      ok: false,
      error: 'No se pudieron actualizar las esperas.',
      procesados: 0,
      activados: 0,
      cancelados: 0,
      ajustados: 0,
    }
  }
}

export interface ImputacionResult {
  ok: boolean
  error?: string
  periodo?: string
  creadas: number
  omitidas: number
  importeTotal: number
}

export async function imputarPeriodo(periodo: string): Promise<ImputacionResult> {
  if (isEmbargosMock()) return mock.imputarPeriodo(periodo) as any
  try {
    const session = await requireAuthenticatedSession()
    const per = periodo.trim()
    if (!validarPeriodo(per)) return { ok: false, error: 'Período inválido (usar aaaa-mm).', creadas: 0, omitidas: 0, importeTotal: 0 }

    const embargos = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false, ESTADO: 'ACTIVO' },
      include: { RETENCION_EMBARGO: { orderBy: { PERIODO: 'asc' } } },
    })

    let creadas = 0
    let omitidas = 0
    let importeTotal = 0

    for (const embargo of embargos) {
      const yaExiste = embargo.RETENCION_EMBARGO.some((item) => item.PERIODO === per)
      const saldo = roundMoney(
        embargo.RETENCION_EMBARGO.reduce(
          (acc, item) => acc - Number(item.RETENCION_MENSUAL) + Number(item.DEVOLUCION),
          Number(embargo.DEUDA),
        ),
      )
      if (yaExiste || saldo <= 0) {
        omitidas += 1
        continue
      }

      const importeMensual = Number(embargo.IMPORTE_MENSUAL)
      const porcentaje = Number(embargo.PORCENTAJE ?? 0)
      const base = importeMensual > 0 ? importeMensual : porcentaje > 0 ? (saldo * porcentaje) / 100 : saldo
      const retencion = roundMoney(Math.min(base, saldo))
      if (retencion <= 0) {
        omitidas += 1
        continue
      }

      await prisma.rETENCION_EMBARGO.create({
        data: {
          ID_EMBARGO: embargo.ID_EMBARGO,
          PERIODO: per,
          RETENCION_MENSUAL: decimal(retencion),
          SALDO: decimal(roundMoney(saldo - retencion)),
          USUARIO_CREACION: session.userId,
        },
      })
      await recalcularSaldos(embargo.ID_EMBARGO)
      creadas += 1
      importeTotal = roundMoney(importeTotal + retencion)
    }

    return { ok: true, periodo: per, creadas, omitidas, importeTotal }
  } catch (error) {
    logServerError('[imputarPeriodo] Error:', error)
    return {
      ok: false,
      error: 'No se pudo imputar el período.',
      creadas: 0,
      omitidas: 0,
      importeTotal: 0,
    }
  }
}

export async function generarResumen(periodo: string): Promise<{ ok: boolean; error?: string; filas: ResumenRetencion[] }> {
  if (isEmbargosMock()) return mock.generarResumen(periodo)
  try {
    await requireAuthenticatedSession()
    const per = periodo.trim()
    if (!validarPeriodo(per)) return { ok: false, error: 'Período inválido (usar aaaa-mm).', filas: [] }

    const filas = await prisma.rETENCION_EMBARGO.findMany({
      where: { PERIODO: per },
      include: {
        EMBARGO: {
          include: {
            DATOS_PERSONALES_AGENTE_JUBILA: {
              select: {
                DNI_AGENTE: true,
                APELLIDO_AGENTE: true,
                SEGUNDO_APELLIDO_AGENTE: true,
                NOMBRE_AGENTE: true,
                SEGUNDO_NOMBRE_AGENTE: true,
              },
            },
          },
        },
      },
      orderBy: { EMBARGO: { DATOS_PERSONALES_AGENTE_JUBILA: { APELLIDO_AGENTE: 'asc' } } },
    })

    return {
      ok: true,
      filas: filas.map((fila) => ({
        idRetencion: fila.ID_RETENCION,
        periodo: fila.PERIODO,
        dni: fila.EMBARGO.DATOS_PERSONALES_AGENTE_JUBILA.DNI_AGENTE ?? '',
        agente: composeFullName({
          apellido: fila.EMBARGO.DATOS_PERSONALES_AGENTE_JUBILA.APELLIDO_AGENTE,
          segundoApellido: fila.EMBARGO.DATOS_PERSONALES_AGENTE_JUBILA.SEGUNDO_APELLIDO_AGENTE,
          nombre: fila.EMBARGO.DATOS_PERSONALES_AGENTE_JUBILA.NOMBRE_AGENTE,
          segundoNombre: fila.EMBARGO.DATOS_PERSONALES_AGENTE_JUBILA.SEGUNDO_NOMBRE_AGENTE,
        }),
        autos: fila.EMBARGO.AUTOS ?? '',
        expediente: fila.EMBARGO.EXPEDIENTE ?? '',
        sueldo: Number(fila.SUELDO),
        refrigerio: Number(fila.REFRIGERIO),
        retencionMensual: Number(fila.RETENCION_MENSUAL),
        devolucion: Number(fila.DEVOLUCION),
        saldo: Number(fila.SALDO),
      })),
    }
  } catch (error) {
    logServerError('[generarResumen] Error:', error)
    return { ok: false, error: 'No se pudo generar el resumen del período.', filas: [] }
  }
}

function resumenToCsv(filas: ResumenRetencion[]): string {
  return toCsv(
    ['PERIODO', 'DNI', 'AGENTE', 'EXPEDIENTE', 'AUTOS', 'SUELDO', 'REFRIGERIO', 'RETENCION', 'DEVOLUCION', 'SALDO'],
    filas.map((fila) => [
      periodoLabel(fila.periodo),
      fila.dni,
      fila.agente,
      fila.expediente,
      fila.autos,
      fila.sueldo.toFixed(2),
      fila.refrigerio.toFixed(2),
      fila.retencionMensual.toFixed(2),
      fila.devolucion.toFixed(2),
      fila.saldo.toFixed(2),
    ]),
  )
}

export async function exportarResumen(periodo: string): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  if (isEmbargosMock()) return mock.exportarResumen(periodo)
  const resultado = await generarResumen(periodo)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return {
    ok: true,
    contenido: resumenToCsv(resultado.filas),
    nombre: `resumen-retenciones-${periodo}.csv`,
  }
}

export async function exportarDisquete(periodo: string): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  if (isEmbargosMock()) return mock.exportarDisquete(periodo)
  // El "disquete" legacy se reemplaza por un TXT delimitado listo para liquidación.
  const resultado = await exportarResumen(periodo)
  if (!resultado.ok || !resultado.contenido) return resultado
  return {
    ok: true,
    contenido: resultado.contenido,
    nombre: `disquete-retenciones-${periodo}.txt`,
  }
}

export async function exportarActivos(): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  if (isEmbargosMock()) return mock.exportarActivos()
  try {
    await requireAuthenticatedSession()
    const filas = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false, ESTADO: 'ACTIVO' },
      include: includeEmbargo,
      orderBy: { DATOS_PERSONALES_AGENTE_JUBILA: { APELLIDO_AGENTE: 'asc' } },
    })
    const embargos = filas.map(mapEmbargo)
    const contenido = toCsv(
      ['DNI', 'AGENTE', 'PROGRAMA', 'EXPEDIENTE', 'AUTOS', 'DEUDA', 'IMPORTE_MENSUAL', 'RETENIDO', 'SALDO'],
      embargos.map((item) => [
        item.dni,
        item.agente,
        item.programa,
        item.expediente,
        item.autos,
        item.deuda.toFixed(2),
        item.importeMensual.toFixed(2),
        item.totalRetenido.toFixed(2),
        item.saldoActual.toFixed(2),
      ]),
    )
    return { ok: true, contenido, nombre: `activos-retencion-${periodoActual()}.csv` }
  } catch (error) {
    logServerError('[exportarActivos] Error:', error)
    return { ok: false, error: 'No se pudo generar el archivo de activos.' }
  }
}

interface BackupRetencion {
  periodo: string
  sueldo: number
  refrigerio: number
  retencionMensual: number
  saldo: number
  devolucion: number
  observaciones: string
}

interface BackupEmbargo {
  dni: string
  agente: string
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
  deuda: number
  importeMensual: number
  porcentaje: number
  marcaEspecial: string
  observaciones: string
  fechaAlta: string
  retenciones: BackupRetencion[]
}

interface BackupArchivo {
  version: number
  generadoEl: string
  embargos: BackupEmbargo[]
}

export async function exportarBackup(): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  if (isEmbargosMock()) return mock.exportarBackup()
  try {
    await requireAuthenticatedSession()
    const filas = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false },
      include: includeEmbargo,
      orderBy: { ID_EMBARGO: 'asc' },
    })

    const backup: BackupArchivo = {
      version: 1,
      generadoEl: new Date().toISOString(),
      embargos: filas.map((fila) => {
        const embargo = mapEmbargo(fila)
        return {
          dni: embargo.dni,
          agente: embargo.agente,
          estado: embargo.estado,
          autos: embargo.autos,
          expediente: embargo.expediente,
          fechaExpediente: embargo.fechaExpediente,
          cuenta: embargo.cuenta,
          sucursal: embargo.sucursal,
          juez: embargo.juez,
          instancia: embargo.instancia,
          nomenclatura: embargo.nomenclatura,
          tipoProceso: embargo.tipoProceso,
          secretaria: embargo.secretaria,
          deuda: embargo.deuda,
          importeMensual: embargo.importeMensual,
          porcentaje: embargo.porcentaje,
          marcaEspecial: embargo.marcaEspecial,
          observaciones: embargo.observaciones,
          fechaAlta: embargo.fechaAlta,
          retenciones: [...fila.RETENCION_EMBARGO]
            .sort((a, b) => a.PERIODO.localeCompare(b.PERIODO))
            .map((retencion) => ({
              periodo: retencion.PERIODO,
              sueldo: Number(retencion.SUELDO),
              refrigerio: Number(retencion.REFRIGERIO),
              retencionMensual: Number(retencion.RETENCION_MENSUAL),
              saldo: Number(retencion.SALDO),
              devolucion: Number(retencion.DEVOLUCION),
              observaciones: retencion.OBSERVACIONES ?? '',
            })),
        }
      }),
    }

    return {
      ok: true,
      contenido: JSON.stringify(backup, null, 2),
      nombre: `backup-embargos-${periodoActual()}.json`,
    }
  } catch (error) {
    logServerError('[exportarBackup] Error:', error)
    return { ok: false, error: 'No se pudo generar el backup.' }
  }
}

function esBackupRetencion(value: unknown): value is BackupRetencion {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.periodo === 'string' && validarPeriodo(item.periodo)
}

function esBackupEmbargo(value: unknown): value is BackupEmbargo {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.dni === 'string' && item.dni.trim().length > 0
}

export interface RestauracionResult {
  ok: boolean
  error?: string
  creados: number
  omitidos: number
  errores: string[]
}

export async function restaurarBackup(payload: string): Promise<RestauracionResult> {
  if (isEmbargosMock()) return mock.restaurarBackup(payload) as any
  try {
    const session = await requireAuthenticatedSession()
    let parsed: unknown
    try {
      parsed = JSON.parse(payload.replace(/^\uFEFF/, ''))
    } catch {
      return { ok: false, error: 'El archivo no es un JSON válido.', creados: 0, omitidos: 0, errores: [] }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'El backup no tiene el formato esperado.', creados: 0, omitidos: 0, errores: [] }
    }

    const data = parsed as { version?: unknown; embargos?: unknown }
    if (data.version !== 1 || !Array.isArray(data.embargos)) {
      return { ok: false, error: 'Versión de backup no soportada.', creados: 0, omitidos: 0, errores: [] }
    }

    let creados = 0
    let omitidos = 0
    const errores: string[] = []

    for (const raw of data.embargos.slice(0, 1000)) {
      if (!esBackupEmbargo(raw)) {
        omitidos += 1
        continue
      }

      const agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findFirst({
        where: { DNI_AGENTE: raw.dni, BIT_BORRADO: false },
        select: { ID_DATOS_PERSONALES_AGENTE_JUBILA: true },
      })
      if (!agente) {
        omitidos += 1
        errores.push(`DNI ${raw.dni}: agente inexistente.`)
        continue
      }

      const existente = raw.expediente
        ? await prisma.eMBARGO.findFirst({
            where: {
              ID_AGENTE: agente.ID_DATOS_PERSONALES_AGENTE_JUBILA,
              EXPEDIENTE: raw.expediente,
              BIT_BORRADO: false,
            },
            select: { ID_EMBARGO: true },
          })
        : null
      if (existente) {
        omitidos += 1
        continue
      }

      const dataEmbargo = {
        ESTADO: validarEstado(raw.estado) ?? 'ESPERA',
        AUTOS: raw.autos?.trim() || null,
        EXPEDIENTE: raw.expediente?.trim() || null,
        FECHA_EXPEDIENTE: raw.fechaExpediente ? parseDate(raw.fechaExpediente) : null,
        CUENTA: raw.cuenta?.trim() || null,
        SUCURSAL: raw.sucursal?.trim() || null,
        JUEZ: raw.juez?.trim() || null,
        INSTANCIA: raw.instancia?.trim() || null,
        NOMENCLATURA: raw.nomenclatura?.trim() || null,
        TIPO_PROCESO: raw.tipoProceso?.trim() || null,
        SECRETARIA: raw.secretaria?.trim() || null,
        DEUDA: decimal(Number(raw.deuda) || 0),
        IMPORTE_MENSUAL: decimal(Number(raw.importeMensual) || 0),
        PORCENTAJE: raw.porcentaje ? decimal(Number(raw.porcentaje)) : null,
        MARCA_ESPECIAL: raw.marcaEspecial?.trim() || null,
        OBSERVACIONES: raw.observaciones?.trim() || null,
      }

      try {
        const creado = await prisma.eMBARGO.create({
          data: {
            ID_AGENTE: agente.ID_DATOS_PERSONALES_AGENTE_JUBILA,
            ...dataEmbargo,
            FECHA_ALTA: raw.fechaAlta ? parseDate(raw.fechaAlta) ?? new Date() : new Date(),
            USUARIO_CREACION: session.userId,
          },
          select: { ID_EMBARGO: true },
        })

        const retenciones = Array.isArray(raw.retenciones) ? raw.retenciones.filter(esBackupRetencion) : []
        for (const retencion of retenciones) {
          await prisma.rETENCION_EMBARGO.create({
            data: {
              ID_EMBARGO: creado.ID_EMBARGO,
              PERIODO: retencion.periodo,
              SUELDO: decimal(Number(retencion.sueldo) || 0),
              REFRIGERIO: decimal(Number(retencion.refrigerio) || 0),
              RETENCION_MENSUAL: decimal(Number(retencion.retencionMensual) || 0),
              SALDO: decimal(Number(retencion.saldo) || 0),
              DEVOLUCION: decimal(Number(retencion.devolucion) || 0),
              OBSERVACIONES: retencion.observaciones?.trim() || null,
              USUARIO_CREACION: session.userId,
            },
          })
        }
        await recalcularSaldos(creado.ID_EMBARGO)
        creados += 1
      } catch {
        omitidos += 1
        errores.push(`Expediente ${raw.expediente || 's/n'}: no se pudo restaurar.`)
      }
    }

    return { ok: true, creados, omitidos, errores: errores.slice(0, 20) }
  } catch (error) {
    logServerError('[restaurarBackup] Error:', error)
    return { ok: false, error: 'No se pudo restaurar el backup.', creados: 0, omitidos: 0, errores: [] }
  }
}

export interface Inconsistencia {
  idEmbargo: number
  dni: string
  agente: string
  expediente: string
  detalle: string
}

export async function verificarIntegridad(): Promise<{
  ok: boolean
  error?: string
  revisados: number
  inconsistencias: Inconsistencia[]
}> {
  if (isEmbargosMock()) return mock.verificarIntegridad() as any
  try {
    await requireAuthenticatedSession()
    const filas = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false },
      include: includeEmbargo,
    })

    const inconsistencias: Inconsistencia[] = []
    for (const fila of filas) {
      const embargo = mapEmbargo(fila)
      const saldoCalculado = roundMoney(
        [...fila.RETENCION_EMBARGO].reduce(
          (acc, item) => acc - Number(item.RETENCION_MENSUAL) + Number(item.DEVOLUCION),
          Number(fila.DEUDA),
        ),
      )
      if (saldoCalculado !== embargo.saldoActual) {
        inconsistencias.push({
          idEmbargo: embargo.id,
          dni: embargo.dni,
          agente: embargo.agente,
          expediente: embargo.expediente,
          detalle: `Saldo registrado ${embargo.saldoActual.toFixed(2)} ≠ saldo calculado ${saldoCalculado.toFixed(2)}.`,
        })
      }
      if (embargo.saldoActual < 0) {
        inconsistencias.push({
          idEmbargo: embargo.id,
          dni: embargo.dni,
          agente: embargo.agente,
          expediente: embargo.expediente,
          detalle: `Saldo negativo (${embargo.saldoActual.toFixed(2)}).`,
        })
      }
      if (embargo.estado === 'ACTIVO' && embargo.cantidadRetenciones === 0) {
        inconsistencias.push({
          idEmbargo: embargo.id,
          dni: embargo.dni,
          agente: embargo.agente,
          expediente: embargo.expediente,
          detalle: 'Embargo activo sin retenciones imputadas.',
        })
      }
    }

    return { ok: true, revisados: filas.length, inconsistencias }
  } catch (error) {
    logServerError('[verificarIntegridad] Error:', error)
    return { ok: false, error: 'No se pudo verificar la integridad.', revisados: 0, inconsistencias: [] }
  }
}

export async function reindexarSaldos(): Promise<{ ok: boolean; error?: string; procesados: number }> {
  if (isEmbargosMock()) return mock.reindexarSaldos()
  try {
    await requireAuthenticatedSession()
    const filas = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false },
      select: { ID_EMBARGO: true },
    })
    for (const fila of filas) {
      await recalcularSaldos(fila.ID_EMBARGO)
    }
    return { ok: true, procesados: filas.length }
  } catch (error) {
    logServerError('[reindexarSaldos] Error:', error)
    return { ok: false, error: 'No se pudieron reindexar los saldos.', procesados: 0 }
  }
}
