'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import {
  exportarLiquidacionVisma,
  type LiquidacionVismaResult,
} from '@/app/actions/embargos'
import {
  downloadBase64File,
  periodoActual,
  periodoLabel,
  periodoSiguiente,
} from '@/lib/embargos'
import { Banner } from '@/components/embargos/ui'
import { ActionCard, PeriodPicker } from '@/components/embargos/action-card'
import ImportarRetencionesPlanilla from '@/components/embargos/importar-retenciones-planilla'
import ImportarOficiosMasivo from '@/components/embargos/importar-oficios-masivo'

export default function ActualizarEmbargos({
  onOpenAgent,
}: {
  /** Abre la ficha de un agente desde la carga masiva de oficios. */
  onOpenAgent?: (agenteId: number) => void
}) {
  const [periodoLiquidacion, setPeriodoLiquidacion] = useState(() => periodoSiguiente(periodoActual()))

  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [liquidacionVisma, setLiquidacionVisma] = useState<LiquidacionVismaResult | null>(null)
  const [vismaError, setVismaError] = useState<string | null>(null)

  const runVisma = async () => {
    setRunning('visma')
    setLiquidacionVisma(null)
    setVismaError(null)
    setError(null)
    try {
      const resultado = await exportarLiquidacionVisma(periodoLiquidacion)
      if (!resultado.ok || !resultado.contenidoBase64) {
        setVismaError(resultado.error ?? 'No se pudo generar la interfaz de VISMA.')
        return
      }
      downloadBase64File(
        resultado.nombre ?? `interfaz embargos ${periodoLiquidacion}.xlsx`,
        resultado.contenidoBase64,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      setLiquidacionVisma(resultado)
      setNotice(`Interfaz VISMA de ${periodoLabel(periodoLiquidacion)} generada con ${resultado.filas ?? 0} embargo(s).`)
    } catch {
      setVismaError('No se pudo generar la interfaz de VISMA. Verificá la conexión.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Actualizar embargos</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Carga de retenciones desde la planilla de Excel, incorporación masiva de oficios judiciales y generación
          de la interfaz para VISMA.
        </p>
      </div>

      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}

      <ImportarRetencionesPlanilla />
      <ImportarOficiosMasivo onOpenAgent={onOpenAgent} />

      {/* Interfaz VISMA */}
      <ActionCard
        icon={<FileSpreadsheet className="h-4 w-4" />}
        title="Interfaz VISMA · Embargos"
        description="Genera el Excel que se envía a VISMA para liquidar los sueldos: una fila por legajo con el saldo pendiente actual, calculado con todas las retenciones ya registradas. El mes a liquidar solo define la fecha (día 1) y el nombre del archivo."
        tone="emerald"
      >
        <PeriodPicker
          value={periodoLiquidacion}
          onChange={setPeriodoLiquidacion}
          label="Mes a liquidar"
          hint="Define la fecha del archivo (día 1) y su nombre. El saldo es siempre el actual."
        />
        <button
          type="button"
          onClick={() => void runVisma()}
          disabled={running !== null || !periodoLiquidacion}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {running === 'visma' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar Excel VISMA
        </button>
        {vismaError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
            {vismaError}
          </p>
        )}
        {liquidacionVisma && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              {liquidacionVisma.filas} embargos
            </span>
            {Boolean(liquidacionVisma.omitidos) && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                {liquidacionVisma.omitidos} omitidos
              </span>
            )}
            <span className="truncate rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600" title={liquidacionVisma.nombre}>
              {liquidacionVisma.nombre}
            </span>
          </div>
        )}
      </ActionCard>
    </div>
  )
}
