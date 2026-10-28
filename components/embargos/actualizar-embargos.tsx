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
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import {
  actualizarEsperas,
  consultarEmbargos,
  eliminarEmbargo,
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
  type Embargo,
  type ResumenRetencion,
} from '@/lib/embargos'
import { Banner, ConfirmDialog, Money, TextField } from '@/components/embargos/ui'

function ActionCard({
  icon,
  title,
  description,
  children,
  tone = 'blue',
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'slate' | 'rose'
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-[#1e3a8a]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone]
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${tones}`}>{icon}</div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">{children}</div>
    </div>
  )
}

function PeriodPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <TextField
      label="Período"
      value={value}
      onChange={onChange}
      type="month"
      hint="Formato aaaa-mm. Por defecto, mes actual."
    />
  )
}

export default function ActualizarEmbargos() {
  const [periodo, setPeriodo] = useState(periodoActual())
  const [periodoDisquete, setPeriodoDisquete] = useState(periodoActual())

  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [esperas, setEsperas] = useState<ActualizacionMasivaResult | null>(null)
  const [imputacion, setImputacion] = useState<ImputacionResult | null>(null)
  const [resumen, setResumen] = useState<ResumenRetencion[] | null>(null)

  const [expedienteBusqueda, setExpedienteBusqueda] = useState('')
  const [eliminarResultados, setEliminarResultados] = useState<Embargo[]>([])
  const [eliminarBuscado, setEliminarBuscado] = useState(false)
  const [eliminarTarget, setEliminarTarget] = useState<Embargo | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        `Esperas actualizadas: ${resultado.procesados} revisadas, ${resultado.activados} activadas, ${resultado.cancelados} canceladas y ${resultado.ajustados} con saldo ajustado.`,
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
      ['PERIODO', 'DNI', 'AGENTE', 'EXPEDIENTE', 'AUTOS', 'SUELDO', 'REFRIGERIO', 'RETENCION', 'DEVOLUCION', 'SALDO'],
      resumen.map((fila) => [
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

  const buscarParaEliminar = async () => {
    const texto = expedienteBusqueda.trim()
    if (!texto) return
    setRunning('buscar-eliminar')
    setEliminarBuscado(false)
    try {
      const filas = await consultarEmbargos({ tipo: 'EXPEDIENTE', texto })
      setEliminarResultados(filas)
      setEliminarBuscado(true)
    } catch {
      setError('No se pudo buscar el expediente.')
    } finally {
      setRunning(null)
    }
  }

  const confirmarEliminar = async () => {
    if (!eliminarTarget) return
    setDeleting(true)
    try {
      const resultado = await eliminarEmbargo(eliminarTarget.id)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo eliminar el embargo.')
        return
      }
      setNotice(`Embargo ${eliminarTarget.expediente || `#${eliminarTarget.id}`} eliminado.`)
      setEliminarTarget(null)
      const filas = await consultarEmbargos({ tipo: 'EXPEDIENTE', texto: expedienteBusqueda.trim() })
      setEliminarResultados(filas)
    } catch {
      setError('No se pudo eliminar el embargo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Actualizar embargos</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Réplica del menú legacy “ACTUALIZAR”: actualización de esperas, imputación mensual, emisión de resumen,
          eliminación de registros y generación de archivos de liquidación. Todas las acciones se ejecutan sin salir de esta pantalla.
        </p>
      </div>

      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Actualizar esperas */}
        <ActionCard
          icon={<RefreshCw className="h-4 w-4" />}
          title="Actualizar esperas y saldos"
          description="Recalcula los saldos de todos los embargos, activa las esperas con retenciones imputadas y cancela las deudas ya saldadas."
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
              <div className="rounded-lg bg-slate-100 p-2"><p className="text-lg font-bold text-slate-600">{esperas.cancelados}</p><p className="text-[9px] uppercase text-slate-500">Cancelados</p></div>
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
          description="Genera el resumen de retenciones del período con sueldo, refrigerio, retención, devolución y saldo. Se puede previsualizar y descargar en CSV."
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
              <table className="w-full min-w-[520px] text-[10px]">
                <thead className="sticky top-0 bg-slate-100 uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Agente</th>
                    <th className="px-2 py-1.5 text-left">Exp. Judicial</th>
                    <th className="px-2 py-1.5 text-right">Retención</th>
                    <th className="px-2 py-1.5 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumen.map((fila) => (
                    <tr key={fila.idRetencion}>
                      <td className="px-2 py-1.5 font-semibold text-slate-700">{fila.agente}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">{fila.expediente || '—'}</td>
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
          title="Altas · Activar esperas previas al sueldo"
          description="Revisa las altas pendientes y activa las esperas que ya tienen retenciones imputadas, dejándolas listas para el próximo sueldo."
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
            Las altas sin retenciones permanecen en estado E (espera).
          </p>
        </ActionCard>
      </div>

      {/* Eliminar registro */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700">
            <Trash2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Eliminar registro</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Buscá por número de expediente y eliminá el embargo desde acá. Se quita de las consultas y de la ficha del agente.
            </p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <TextField
              label="Número de expediente"
              value={expedienteBusqueda}
              onChange={setExpedienteBusqueda}
              placeholder="Ej: 006.148/26"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => void buscarParaEliminar()}
              disabled={running !== null || !expedienteBusqueda.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
            >
              {running === 'buscar-eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Buscar
            </button>
          </div>

          {eliminarBuscado && eliminarResultados.length === 0 && (
            <Banner tone="info">No se encontraron embargos para ese expediente.</Banner>
          )}

          {eliminarResultados.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Agente</th>
                    <th className="px-3 py-2 text-left">Autos</th>
                    <th className="px-3 py-2 text-left">Exp. Judicial</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eliminarResultados.map((embargo) => (
                    <tr key={embargo.id}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{embargo.agente}<span className="ml-1 text-[10px] font-normal text-slate-400">DNI {embargo.dni}</span></td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-slate-600">{embargo.autos || '—'}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{embargo.expediente || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-rose-600"><Money value={embargo.saldoActual} /></td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setEliminarTarget(embargo)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(eliminarTarget)}
        title="Eliminar embargo"
        description={
          eliminarTarget ? (
            <>
              Se eliminará el embargo de <strong>{eliminarTarget.agente}</strong> (expediente {eliminarTarget.expediente || 's/n'}).
              Esta acción no se puede deshacer desde la pantalla.
            </>
          ) : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onCancel={() => setEliminarTarget(null)}
        onConfirm={() => void confirmarEliminar()}
      />
    </div>
  )
}
