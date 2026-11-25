'use server'

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { composeFullName } from '@/lib/empleados'
import { roundMoney } from '@/lib/embargos'
import { rangoPeriodoBuenosAires } from '@/lib/timezone'
import { logServerError } from '@/lib/safe-error'
import type {
  ReporteSaldosResult,
  SaldoEmbargoReporte,
  SaldoMesReporte,
} from '@/lib/reporte-saldos'

interface RetencionReporte {
  PERIODO: string
  RETENCION_MENSUAL: unknown
  SUELDO: unknown
  REFRIGERIO: unknown
  DEVOLUCION: unknown
}

function montoRetenido(retencion: RetencionReporte): number {
  const mensual = Number(retencion.RETENCION_MENSUAL ?? 0)
  if (mensual > 0) return roundMoney(mensual)
  return roundMoney(Number(retencion.SUELDO ?? 0) + Number(retencion.REFRIGERIO ?? 0))
}

function periodoValido(periodo: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)
}

/** Inicio del mes siguiente en horario de Buenos Aires (exclusivo). */
function finDeMes(periodo: string): Date {
  const rango = rangoPeriodoBuenosAires(periodo)
  if (rango) return rango.hastaExclusivo
  const [anio, mes] = periodo.split('-').map(Number)
  return new Date(Date.UTC(anio, mes, 1, 3, 0, 0, 0))
}

/** Inicio del mes en horario de Buenos Aires. */
function inicioDeMes(periodo: string): Date {
  const rango = rangoPeriodoBuenosAires(periodo)
  if (rango) return rango.desde
  const [anio, mes] = periodo.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0, 0))
}

function mesesDelAnio(anio: number): string[] {
  return Array.from(
    { length: 12 },
    (_, indice) => `${anio}-${String(indice + 1).padStart(2, '0')}`,
  )
}

function redondear(valor: number): number {
  return roundMoney(valor)
}

export async function obtenerReporteSaldos(periodo: string): Promise<ReporteSaldosResult> {
  try {
    await requireAuthenticatedSession()

    const per = periodo.trim()
    if (!periodoValido(per)) {
      return {
        ok: false,
        error: 'Mes inválido (usar aaaa-mm).',
        meses: [],
        detalle: [],
      }
    }

    const embargos = await prisma.eMBARGO.findMany({
      where: { BIT_BORRADO: false },
      select: {
        ID_EMBARGO: true,
        DEUDA: true,
        FECHA_ALTA: true,
        FECHA_BAJA: true,
        ESTADO: true,
        EXPEDIENTE: true,
        DATOS_PERSONALES_AGENTE_JUBILA: {
          select: {
            DNI_AGENTE: true,
            APELLIDO_AGENTE: true,
            SEGUNDO_APELLIDO_AGENTE: true,
            NOMBRE_AGENTE: true,
            SEGUNDO_NOMBRE_AGENTE: true,
          },
        },
        RETENCION_EMBARGO: {
          select: {
            PERIODO: true,
            RETENCION_MENSUAL: true,
            SUELDO: true,
            REFRIGERIO: true,
            DEVOLUCION: true,
          },
          orderBy: { PERIODO: 'asc' },
        },
      },
      orderBy: { ID_EMBARGO: 'asc' },
    })

    // La fecha de alta registrada puede ser posterior al primer período con
    // retención (por ejemplo, al importar una planilla de un mes anterior).
    // Para el reporte histórico se toma la más antigua de las dos.
    const altaEfectiva = new Map<number, Date>()
    for (const embargo of embargos) {
      const primerPeriodo = embargo.RETENCION_EMBARGO[0]?.PERIODO
      const inicioPrimeraRetencion = primerPeriodo ? inicioDeMes(primerPeriodo) : null
      altaEfectiva.set(
        embargo.ID_EMBARGO,
        inicioPrimeraRetencion && inicioPrimeraRetencion < embargo.FECHA_ALTA
          ? inicioPrimeraRetencion
          : embargo.FECHA_ALTA,
      )
    }

    const vigenteAlCierre = (
      embargo: (typeof embargos)[number],
      finExclusivo: Date,
    ): boolean => {
      const alta = altaEfectiva.get(embargo.ID_EMBARGO) ?? embargo.FECHA_ALTA
      return alta < finExclusivo && (!embargo.FECHA_BAJA || embargo.FECHA_BAJA >= finExclusivo)
    }

    const anio = Number(per.slice(0, 4))
    const meses = mesesDelAnio(anio)

    const resumen: SaldoMesReporte[] = meses.map((mes) => {
      const fin = finDeMes(mes)
      const vigentes = embargos.filter((embargo) => vigenteAlCierre(embargo, fin))

      let deuda = 0
      let retenidoMes = 0
      let retenidoAcumulado = 0

      for (const embargo of vigentes) {
        deuda += Number(embargo.DEUDA)
        for (const retencion of embargo.RETENCION_EMBARGO) {
          if (retencion.PERIODO > mes) continue
          const neto = montoRetenido(retencion) - Number(retencion.DEVOLUCION)
          retenidoAcumulado += neto
          if (retencion.PERIODO === mes) retenidoMes += neto
        }
      }

      deuda = redondear(deuda)
      retenidoMes = redondear(retenidoMes)
      retenidoAcumulado = redondear(retenidoAcumulado)

      return {
        periodo: mes,
        embargos: vigentes.length,
        deuda,
        retenidoMes,
        retenidoAcumulado,
        saldo: redondear(deuda - retenidoAcumulado),
      }
    })

    const finSeleccionado = finDeMes(per)
    const detalle: SaldoEmbargoReporte[] = embargos
      .filter((embargo) => vigenteAlCierre(embargo, finSeleccionado))
      .map((embargo) => {
        const retenido = redondear(
          embargo.RETENCION_EMBARGO.reduce((acc, retencion) => {
            if (retencion.PERIODO > per) return acc
            return acc + montoRetenido(retencion) - Number(retencion.DEVOLUCION)
          }, 0),
        )
        const deuda = redondear(Number(embargo.DEUDA))
        const agente = composeFullName({
          apellido: embargo.DATOS_PERSONALES_AGENTE_JUBILA.APELLIDO_AGENTE,
          segundoApellido: embargo.DATOS_PERSONALES_AGENTE_JUBILA.SEGUNDO_APELLIDO_AGENTE,
          nombre: embargo.DATOS_PERSONALES_AGENTE_JUBILA.NOMBRE_AGENTE,
          segundoNombre: embargo.DATOS_PERSONALES_AGENTE_JUBILA.SEGUNDO_NOMBRE_AGENTE,
        })

        return {
          id: embargo.ID_EMBARGO,
          dni: (embargo.DATOS_PERSONALES_AGENTE_JUBILA.DNI_AGENTE ?? '').replace(/\D/g, ''),
          agente,
          expediente: embargo.EXPEDIENTE ?? '',
          estado: embargo.ESTADO,
          deuda,
          retenido,
          saldo: redondear(deuda - retenido),
        }
      })
      .sort((a, b) => b.saldo - a.saldo || a.agente.localeCompare(b.agente, 'es'))

    return {
      ok: true,
      periodo: per,
      meses: resumen,
      detalle,
      totales: resumen.find((mes) => mes.periodo === per),
    }
  } catch (error) {
    logServerError('[obtenerReporteSaldos] Error:', error)
    return {
      ok: false,
      error: 'No se pudo generar el reporte de saldos.',
      meses: [],
      detalle: [],
    }
  }
}

export interface ReporteSaldosExcelResult {
  ok: boolean
  error?: string
  contenidoBase64?: string
  nombre?: string
}

/** Genera el Excel del reporte con la hoja de resumen y la de detalle. */
export async function exportarReporteSaldosExcel(
  periodo: string,
): Promise<ReporteSaldosExcelResult> {
  try {
    await requireAuthenticatedSession()
    const data = await obtenerReporteSaldos(periodo)
    if (!data.ok || !data.periodo) {
      return { ok: false, error: data.error ?? 'No se pudo generar el reporte de saldos.' }
    }

    const { generarExcelReporteSaldos } = await import('@/lib/reporte-saldos-excel')
    const buffer = await generarExcelReporteSaldos(data)

    return {
      ok: true,
      contenidoBase64: buffer.toString('base64'),
      nombre: `reporte-saldos-${data.periodo}.xlsx`,
    }
  } catch (error) {
    logServerError('[exportarReporteSaldosExcel] Error:', error)
    return { ok: false, error: 'No se pudo generar el Excel del reporte.' }
  }
}
