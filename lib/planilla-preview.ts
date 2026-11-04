/**
 * Vista previa de la importación de la planilla de liquidación.
 *
 * Se ejecuta en el route handler (Node), no como Server Action, porque
 * ExcelJS necesita un stream de Node para leer planillas grandes.
 */

import { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'
import { composeFullName } from '@/lib/empleados'
import { formatMoney, roundMoney } from '@/lib/embargos'
import { parsearPlanillaRetenciones } from '@/lib/planilla-retenciones'

export interface RetencionPlanillaItem {
  dni: string
  agente: string
  nombre: string
  retencionSueldo: number
  retencionRefrigerio: number
  total: number
  procesos: string[]
  conceptos: string[]
  periodo: string
  idEmbargo: number | null
  expediente: string
  saldoDisponible: number
  accion: 'crear' | 'actualizar' | 'error'
  error?: string
}

export interface AnalizarPlanillaResult {
  ok: boolean
  error?: string
  periodo?: string
  items: RetencionPlanillaItem[]
  resumen: {
    total: number
    crear: number
    actualizar: number
    errores: number
    importe: number
  }
  advertencias: string[]
}

export function resumenPlanillaVacio(): AnalizarPlanillaResult {
  return {
    ok: false,
    items: [],
    resumen: { total: 0, crear: 0, actualizar: 0, errores: 0, importe: 0 },
    advertencias: [],
  }
}

async function buscarAgentesPorDnis(dnis: string[]) {
  const select = {
    ID_DATOS_PERSONALES_AGENTE_JUBILA: true,
    DNI_AGENTE: true,
    APELLIDO_AGENTE: true,
    SEGUNDO_APELLIDO_AGENTE: true,
    NOMBRE_AGENTE: true,
    SEGUNDO_NOMBRE_AGENTE: true,
  } as const

  let agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
    where: { DNI_AGENTE: { in: dnis }, BIT_BORRADO: false },
    select,
  })

  const encontrados = new Set(agentes.map((agente) => (agente.DNI_AGENTE ?? '').replace(/\D/g, '')))
  const faltantes = dnis.filter((dni) => !encontrados.has(dni))
  if (faltantes.length > 0) {
    const extra = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
      where: {
        BIT_BORRADO: false,
        OR: faltantes.map((dni) => ({ DNI_AGENTE: { contains: dni } })),
      },
      select,
    })
    agentes = [...agentes, ...extra]
  }

  return agentes
}

async function buscarEmbargosActivos(idsAgente: number[]) {
  if (idsAgente.length === 0) return []
  return prisma.eMBARGO.findMany({
    where: { ID_AGENTE: { in: idsAgente }, BIT_BORRADO: false, ESTADO: 'ACTIVO' },
    select: { ID_EMBARGO: true, ID_AGENTE: true, EXPEDIENTE: true, DEUDA: true },
    orderBy: { ID_EMBARGO: 'asc' },
  })
}

type EmbargoPlanilla = Awaited<ReturnType<typeof buscarEmbargosActivos>>[number]

function montoRetenido(retencion: {
  RETENCION_MENSUAL: unknown
  RETENCION_SUELDO: unknown
  RETENCION_REFRIGERIO: unknown
}): number {
  const mensual = Number(retencion.RETENCION_MENSUAL ?? 0)
  if (mensual > 0) return roundMoney(mensual)
  return roundMoney(Number(retencion.RETENCION_SUELDO ?? 0) + Number(retencion.RETENCION_REFRIGERIO ?? 0))
}

function agruparRetencionesPorEmbargo(
  retenciones: {
    ID_EMBARGO: number
    PERIODO: string
    RETENCION_MENSUAL: unknown
    RETENCION_SUELDO: unknown
    RETENCION_REFRIGERIO: unknown
    DEVOLUCION: unknown
  }[],
) {
  const porEmbargo = new Map<number, typeof retenciones>()
  for (const retencion of retenciones) {
    const lista = porEmbargo.get(retencion.ID_EMBARGO) ?? []
    lista.push(retencion)
    porEmbargo.set(retencion.ID_EMBARGO, lista)
  }
  return porEmbargo
}

function saldoPrevioEmbargo(
  embargo: EmbargoPlanilla,
  periodo: string,
  retenciones: ReturnType<typeof agruparRetencionesPorEmbargo>,
): number {
  const previas = (retenciones.get(embargo.ID_EMBARGO) ?? []).filter((retencion) => retencion.PERIODO < periodo)
  return roundMoney(
    previas.reduce(
      (acc, retencion) => acc - montoRetenido(retencion) + Number(retencion.DEVOLUCION),
      Number(embargo.DEUDA),
    ),
  )
}

export async function analizarPlanillaRetencionesArchivo(
  webStream: ReadableStream<Uint8Array>,
): Promise<AnalizarPlanillaResult> {
  const planilla = await parsearPlanillaRetenciones(Readable.fromWeb(webStream as never))

  if (planilla.filas.length === 0) {
    return {
      ...resumenPlanillaVacio(),
      ok: true,
      periodo: planilla.periodo,
      advertencias: planilla.advertencias,
    }
  }

  const dnis = planilla.filas.map((fila) => fila.dni)
  const agentes = await buscarAgentesPorDnis(dnis)
  const agentePorDni = new Map<string, (typeof agentes)[number]>()
  for (const agente of agentes) {
    agentePorDni.set((agente.DNI_AGENTE ?? '').replace(/\D/g, ''), agente)
  }

  const embargos = await buscarEmbargosActivos(
    agentes.map((agente) => agente.ID_DATOS_PERSONALES_AGENTE_JUBILA),
  )
  const embargoPorAgente = new Map<number, EmbargoPlanilla>()
  for (const embargo of embargos) {
    if (!embargoPorAgente.has(embargo.ID_AGENTE)) embargoPorAgente.set(embargo.ID_AGENTE, embargo)
  }

  const idsEmbargo = [...embargoPorAgente.values()].map((embargo) => embargo.ID_EMBARGO)
  const retenciones = idsEmbargo.length
    ? await prisma.rETENCION_EMBARGO.findMany({
        where: { ID_EMBARGO: { in: idsEmbargo } },
        select: {
          ID_EMBARGO: true,
          PERIODO: true,
          RETENCION_MENSUAL: true,
          RETENCION_SUELDO: true,
          RETENCION_REFRIGERIO: true,
          DEVOLUCION: true,
        },
      })
    : []
  const retencionesPorEmbargo = agruparRetencionesPorEmbargo(retenciones)

  const items: RetencionPlanillaItem[] = []
  for (const fila of planilla.filas) {
    const agente = agentePorDni.get(fila.dni)
    const base: RetencionPlanillaItem = {
      dni: fila.dni,
      agente: agente
        ? composeFullName({
            apellido: agente.APELLIDO_AGENTE,
            segundoApellido: agente.SEGUNDO_APELLIDO_AGENTE,
            nombre: agente.NOMBRE_AGENTE,
            segundoNombre: agente.SEGUNDO_NOMBRE_AGENTE,
          })
        : fila.nombre,
      nombre: fila.nombre,
      retencionSueldo: fila.retencionSueldo,
      retencionRefrigerio: fila.retencionRefrigerio,
      total: fila.total,
      procesos: fila.procesos,
      conceptos: fila.conceptos,
      periodo: planilla.periodo,
      idEmbargo: null,
      expediente: '',
      saldoDisponible: 0,
      accion: 'error',
    }

    if (!agente) {
      items.push({ ...base, error: 'No se encontró el agente por DNI.' })
      continue
    }

    const embargo = embargoPorAgente.get(agente.ID_DATOS_PERSONALES_AGENTE_JUBILA)
    if (!embargo) {
      items.push({ ...base, error: 'El agente no tiene un embargo activo.' })
      continue
    }

    const saldoDisponible = saldoPrevioEmbargo(embargo, planilla.periodo, retencionesPorEmbargo)
    const existente = (retencionesPorEmbargo.get(embargo.ID_EMBARGO) ?? []).find(
      (retencion) => retencion.PERIODO === planilla.periodo,
    )
    const item: RetencionPlanillaItem = {
      ...base,
      idEmbargo: embargo.ID_EMBARGO,
      expediente: embargo.EXPEDIENTE ?? '',
      saldoDisponible: Math.max(saldoDisponible, 0),
    }

    if (fila.total > saldoDisponible) {
      items.push({
        ...item,
        error: `Supera el saldo disponible (${formatMoney(Math.max(saldoDisponible, 0))}).`,
      })
      continue
    }

    items.push({ ...item, accion: existente ? 'actualizar' : 'crear' })
  }

  const resumen = items.reduce(
    (acc, item) => {
      acc.total += 1
      acc.importe = roundMoney(acc.importe + (item.accion === 'error' ? 0 : item.total))
      if (item.accion === 'crear') acc.crear += 1
      else if (item.accion === 'actualizar') acc.actualizar += 1
      else acc.errores += 1
      return acc
    },
    { total: 0, crear: 0, actualizar: 0, errores: 0, importe: 0 },
  )

  return {
    ok: true,
    periodo: planilla.periodo,
    items,
    resumen,
    advertencias: planilla.advertencias,
  }
}
