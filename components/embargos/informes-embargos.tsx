'use client'

import { useState } from 'react'
import {
  CalendarCheck2,
  CalendarSync,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react'
import {
  actualizarEsperas,
  exportarActivos,
  exportarDisquete,
  generarResumen,
  imputarPeriodo,
  type ActualizacionMasivaResult,
  type ImputacionResult,
} from '@/app/actions/embargos'
import {
  downloadTextFile,
  formatMoney,
  periodoActual,
  periodoLabel,
  toCsv,
  todayFileSuffix,
  type ResumenRetencion,
} from '@/lib/embargos'
import { Banner, Money } from '@/components/embargos/ui'
import { ActionCard, PeriodPicker } from '@/components/embargos/action-card'

export default function InformesEmbargos() {
  const [periodo, setPeriodo] = useState(periodoActual())
  const [periodoDisquete, setPeriodoDisquete] = useState(periodoActual())

  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [esperas, setEsperas] = useState<ActualizacionMasivaResult | null>(null)
  const [imputacion, setImputacion] = useState<ImputacionResult | null>(null)
  const [resumen, setResumen] = useState<ResumenRetencion[] | null>(null)

  const runEsperas = async () => {
    setRunning('esperas')
    setEsperas(null)
    try {
      const resultado = await actualizarEsperas()
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudieron actualizar las esperas.')
        return
      }
      setEsperas(resultado)
      setNotice(
        `Esperas actualizadas: ${resultado.procesados} revisadas, ${resultado.activados} activadas, ${resultado.cancelados} dadas de baja y ${resultado.ajustados} con saldo ajustado.`,
      )
    } catch {
      setError('No se pudieron actualizar las esperas. Verifique la conexión.')
    } finally {
      setRunning(null)
    }
  }

  const runImputar = async () => {
    setRunning('imputar')
    setImputacion(null)
    try {
      const resultado = await imputarPeriodo(periodo)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo imputar el período.')
        return
      }
      setImputacion(resultado)
      setNotice(
        `Imputación de ${periodoLabel(resultado.periodo ?? periodo)}: ${resultado.creadas} retenciones creadas por ${formatMoney(resultado.importeTotal)}. ${resultado.omitidas} embargos omitidos.`,
      )
    } catch {
      setError('No se pudo imputar el período. Verifique la conexión.')
    } finally {
      setRunning(null)
    }
  }

  const runResumen = async () => {
    setRunning('resumen')
    setResumen(null)
    try {
      const resultado = await generarResumen(periodo)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo generar el resumen.')
        return
      }
      setResumen(resultado.filas)
      setNotice(
        `Resumen de ${periodoLabel(periodo)} generado con ${resultado.filas.length} retenciones.`,
      )
    } catch {
      setError('No se pudo generar el resumen. Verifique la conexión.')
    } finally {
      setRunning(null)
    }
  }

  const descargarResumen = () => {
    if (!resumen) return
    const contenido = toCsv(
      [
        'PERIODO',
        'DNI',
        'AGENTE',
        'EXPEDIENTE',
        'AUTOS',
        'RETENCION_SUELDO',
        'RETENCION_REFRIGERIO',
        'RETENCION_MENSUAL',
        'DEVOLUCION',
        'SALDO',
      ],
      resumen.map((fila) => [
        periodoLabel(fila.periodo),
        fila.dni,
        fila.agente,
        fila.expediente,
        fila.autos,
        fila.retencionSueldo.toFixed(2),
        fila.retencionRefrigerio.toFixed(2),
        fila.retencionMensual.toFixed(2),
        fila.devolucion.toFixed(2),
        fila.saldo.toFixed(2),
      ]),
    )
    downloadTextFile(`resumen-retenciones-${periodo}.csv`, contenido, 'text/csv;charset=utf-8')
  }

  const runDisquete = async () => {
    setRunning('disquete')
    try {
      const resultado = await exportarDisquete(periodoDisquete)
      if (!resultado.ok || !resultado.contenido) {
        setError(resultado.error ?? 'No se pudo generar el archivo.')
        return
      }
      downloadTextFile(resultado.nombre ?? `disquete-${periodoDisquete}.txt`, resultado.contenido)
      setNotice(`Archivo de liquidación de ${periodoLabel(periodoDisquete)} descargado.`)
    } catch {
      setError('No se pudo generar el archivo de liquidación.')
    } finally {
      setRunning(null)
    }
  }

  const runActivos = async () => {
    setRunning('activos')
    try {
      const resultado = await exportarActivos()
      if (!resultado.ok || !resultado.contenido) {
        setError(resultado.error ?? 'No se pudo generar el archivo de activos.')
        return
      }
      downloadTextFile(
        resultado.nombre ?? `activos-retencion-${todayFileSuffix()}.csv`,
        resultado.contenido,
        'text/csv;charset=utf-8',
      )
      setNotice('Archivo de agentes activos con retención descargado.')
    } catch {
      setError('No se pudo generar el archivo de activos.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Informes y liquidación</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Actualización de esperas, imputación mensual, emisión de resumen y generación de archivos de liquidación.
          Todas las acciones se ejecutan sin salir de esta pantalla.
        </p>
      </div>

      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Actualizar esperas */}
        <ActionCard
          icon={<RefreshCw className="h-4 w-4" />}
          title="Actualizar esperas y saldos"
          description="Recalcula los saldos de todos los embargos, pasa a baja las deudas saldadas y activa la siguiente espera del agente."
          tone="blue"
        >
          <button
            type="button"
            onClick={() => void runEsperas()}
            disabled={running !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
          >
            {running === 'esperas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar esperas
          </button>
          {esperas && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-bold text-slate-800">{esperas.procesados}</p><p className="text-[9px] uppercase text-slate-400">Revisados</p></div>
              <div className="rounded-lg bg-emerald-50 p-2"><p className="text-lg font-bold text-emerald-700">{esperas.activados}</p><p className="text-[9px] uppercase text-emerald-600">Activados</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><p className="text-lg font-bold text-slate-600">{esperas.cancelados}</p><p className="text-[9px] uppercase text-slate-500">Bajas</p></div>
            </div>
          )}
        </ActionCard>

        {/* Imputar */}
        <ActionCard
          icon={<CalendarCheck2 className="h-4 w-4" />}
          title="Imputar sueldo / refrigerio"
          description="Genera la retención del período para todos los embargos activos usando el importe mensual configurado (o el porcentaje/saldo). Omite los que ya tienen ese mes."
          tone="emerald"
        >
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <button
            type="button"
            onClick={() => void runImputar()}
            disabled={running !== null || !periodo}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {running === 'imputar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Imputar período
          </button>
          {imputacion && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{imputacion.creadas} retenciones</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{imputacion.omitidas} omitidas</span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{formatMoney(imputacion.importeTotal)}</span>
            </div>
          )}
        </ActionCard>

        {/* Emisión resumen */}
        <ActionCard
          icon={<FileSpreadsheet className="h-4 w-4" />}
          title="Emisión resumen"
          description="Genera el resumen de retenciones del período con retención de sueldo, retención de refrigerio, retención total, devolución y saldo. Se puede previsualizar y descargar en CSV."
          tone="blue"
        >
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runResumen()}
              disabled={running !== null || !periodo}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
            >
              {running === 'resumen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Generar resumen
            </button>
            <button
              type="button"
              onClick={descargarResumen}
              disabled={!resumen || resumen.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
          {resumen && (
            <div className="max-h-52 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-[10px]">
                <thead className="sticky top-0 bg-slate-100 uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Agente</th>
                    <th className="px-2 py-1.5 text-left">Exp. Judicial</th>
                    <th className="px-2 py-1.5 text-right">Ret. Sueldo</th>
                    <th className="px-2 py-1.5 text-right">Ret. Refrig.</th>
                    <th className="px-2 py-1.5 text-right">Retención total</th>
                    <th className="px-2 py-1.5 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumen.map((fila) => (
                    <tr key={fila.idRetencion}>
                      <td className="px-2 py-1.5 font-semibold text-slate-700">{fila.agente}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">{fila.expediente || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono"><Money value={fila.retencionSueldo} /></td>
                      <td className="px-2 py-1.5 text-right font-mono"><Money value={fila.retencionRefrigerio} /></td>
                      <td className="px-2 py-1.5 text-right font-mono"><Money value={fila.retencionMensual} /></td>
                      <td className="px-2 py-1.5 text-right font-mono text-rose-600"><Money value={fila.saldo} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ActionCard>

        {/* Disquete */}
        <ActionCard
          icon={<HardDriveDownload className="h-4 w-4" />}
          title="Generar disquete / archivo de liquidación"
          description="Reemplaza el antiguo “Generar Disquete”. Descarga un TXT delimitado con las retenciones del período, listo para el circuito de liquidación."
          tone="slate"
        >
          <PeriodPicker value={periodoDisquete} onChange={setPeriodoDisquete} />
          <button
            type="button"
            onClick={() => void runDisquete()}
            disabled={running !== null || !periodoDisquete}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {running === 'disquete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Descargar archivo
          </button>
        </ActionCard>

        {/* Activos refrigerio */}
        <ActionCard
          icon={<Database className="h-4 w-4" />}
          title="Archivo de ACTIVOS p/refrigerio"
          description="Descarga el listado de agentes con embargos activos, importe mensual, total retenido y saldo pendiente, en formato CSV."
          tone="amber"
        >
          <button
            type="button"
            onClick={() => void runActivos()}
            disabled={running !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
          >
            {running === 'activos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Generar archivo de activos
          </button>
        </ActionCard>

        {/* Altas / activar esperas */}
        <ActionCard
          icon={<CalendarSync className="h-4 w-4" />}
          title="Altas · Activar la siguiente espera"
          description="Revisa los embargos pendientes y activa la primera espera cuando el agente no tiene ningún embargo activo, dejándola lista para el próximo sueldo."
          tone="emerald"
        >
          <button
            type="button"
            onClick={() => void runEsperas()}
            disabled={running !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {running === 'esperas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSync className="h-4 w-4" />}
            Activar esperas
          </button>
          <p className="text-[10px] text-slate-400">
            Si el agente ya tiene un embargo activo, las altas permanecen en estado E (espera).
          </p>
        </ActionCard>
      </div>
    </div>
  )
}
