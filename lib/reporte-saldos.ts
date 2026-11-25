/** Reporte de saldos en curso: resumen mensual y detalle por embargo. */

export interface SaldoMesReporte {
  periodo: string
  /** Embargos vigentes al cierre del mes. */
  embargos: number
  /** Deuda original de esos embargos. */
  deuda: number
  /** Retenido neto (retenciones menos devoluciones) del mes. */
  retenidoMes: number
  /** Retenido neto acumulado hasta el cierre del mes. */
  retenidoAcumulado: number
  /** Deuda menos retenido acumulado. */
  saldo: number
}

export interface SaldoEmbargoReporte {
  id: number
  dni: string
  agente: string
  expediente: string
  estado: string
  deuda: number
  retenido: number
  saldo: number
}

export interface ReporteSaldosResult {
  ok: boolean
  error?: string
  periodo?: string
  /** Los 12 meses del año del período seleccionado. */
  meses: SaldoMesReporte[]
  /** Embargos vigentes al cierre del período seleccionado. */
  detalle: SaldoEmbargoReporte[]
  /** Fila del mes seleccionado. */
  totales?: SaldoMesReporte
}
