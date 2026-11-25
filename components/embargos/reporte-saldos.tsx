'use client'

import { useEffect, useState } from 'react'
import { BarChart3, FileSpreadsheet, Loader2 } from 'lucide-react'
import { exportarReporteSaldosExcel, obtenerReporteSaldos } from '@/app/actions/reportes'
import { downloadBase64File, formatMoney, periodoActual } from '@/lib/embargos'
import type { ReporteSaldosResult } from '@/lib/reporte-saldos'
import { Banner } from '@/components/embargos/ui'
import { ActionCard, PeriodPicker } from '@/components/embargos/action-card'

function Tile({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: string
  tone?: 'slate' | 'blue' | 'emerald' | 'rose'
}) {
  const tones = {
    slate: 'bg-slate-50 text-slate-800',
    blue: 'bg-blue-50 text-[#1e3a8a]',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  }[tone]
  return (
    <div className={`rounded-lg p-2 text-center ${tones}`}>
      <p className="text-[9px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs font-bold tracking-tight" title={value}>
        {value}
      </p>
    </div>
  )
}

export default function ReporteSaldos() {
  const [periodo, setPeriodo] = useState(periodoActual())
  const [data, setData] = useState<ReporteSaldosResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = async (per: string) => {
    setLoading(true)
    setError(null)
    try {
      const resultado = await obtenerReporteSaldos(per)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo generar el reporte de saldos.')
        setData(null)
        return
      }
      setData(resultado)
    } catch {
      setError('No se pudo generar el reporte de saldos. Verificá la conexión.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar(periodo)
    // El reporte se recalcula al cambiar el mes seleccionado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  const descargarExcel = async () => {
    if (!data?.periodo) return
    setExportando(true)
    setError(null)
    try {
      const resultado = await exportarReporteSaldosExcel(data.periodo)
      if (!resultado.ok || !resultado.contenidoBase64) {
        setError(resultado.error ?? 'No se pudo generar el Excel del reporte.')
        return
      }
      downloadBase64File(
        resultado.nombre ?? `reporte-saldos-${data.periodo}.xlsx`,
        resultado.contenidoBase64,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch {
      setError('No se pudo generar el Excel del reporte. Verificá la conexión.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <ActionCard
      icon={<BarChart3 className="h-4 w-4" />}
      title="Saldos en curso por mes"
      description="Seleccioná el mes de cierre y descargá el Excel con el resumen mensual y el detalle por embargo."
      tone="blue"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <PeriodPicker
            value={periodo}
            onChange={setPeriodo}
            label="Mes de cierre"
            hint="El resumen muestra los 12 meses del año seleccionado."
          />
        </div>
        <button
          type="button"
          onClick={() => void descargarExcel()}
          disabled={!data || loading || exportando}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {exportando ? 'Generando Excel...' : 'Descargar Excel'}
        </button>
      </div>

      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}

      {data?.totales && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Embargos vigentes" value={String(data.totales.embargos)} tone="slate" />
          <Tile label="Deuda total" value={formatMoney(data.totales.deuda)} tone="blue" />
          <Tile label="Retenido del mes" value={formatMoney(data.totales.retenidoMes)} tone="emerald" />
          <Tile label="Retenido hasta el mes" value={formatMoney(data.totales.retenidoAcumulado)} tone="emerald" />
          <Tile label="Saldo pendiente" value={formatMoney(data.totales.saldo)} tone="rose" />
        </div>
      )}

      {loading && !data && (
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando reporte...
        </p>
      )}
    </ActionCard>
  )
}
