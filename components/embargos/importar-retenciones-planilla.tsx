'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Search,
  Upload,
  X,
} from 'lucide-react'
import {
  importarRetencionesPlanilla,
  type ImportarPlanillaResult,
} from '@/app/actions/embargos'
import type { AnalizarPlanillaResult, RetencionPlanillaItem } from '@/lib/planilla-preview'
import { formatMoney, periodoLabel } from '@/lib/embargos'
import { Banner, Money } from '@/components/embargos/ui'

function AccionBadge({ item }: { item: RetencionPlanillaItem }) {
  if (item.accion === 'crear') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" /> Crear
      </span>
    )
  }
  if (item.accion === 'actualizar') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
        <Upload className="h-2.5 w-2.5" /> Actualizar
      </span>
    )
  }
  if (item.accion === 'no_imputacion') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700">
        <AlertCircle className="h-2.5 w-2.5" /> No imputación
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700">
      <AlertCircle className="h-2.5 w-2.5" /> Error
    </span>
  )
}

/** Panel para importar la planilla mensual de liquidación (Excel). */
export default function ImportarRetencionesPlanilla({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [preview, setPreview] = useState<AnalizarPlanillaResult | null>(null)
  const [resultado, setResultado] = useState<ImportarPlanillaResult | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    if (!preview) return []
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return preview.items
    return preview.items.filter((item) => {
      const textoFila = `${item.dni} ${item.agente} ${item.nombre} ${item.expediente} ${item.procesos.join(' ')}`.toLowerCase()
      return textoFila.includes(texto)
    })
  }, [preview, busqueda])

  const seleccionarArchivo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setArchivo(file)
    setPreview(null)
    setResultado(null)
    setError(null)
    setNotice(null)
    if (file) void procesar(file)
  }

  const limpiar = () => {
    setArchivo(null)
    setPreview(null)
    setResultado(null)
    setError(null)
    setBusqueda('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const procesar = async (file: File | null = archivo) => {
    if (!file) {
      setError('Seleccioná primero la planilla de liquidación.')
      return
    }
    setProcesando(true)
    setPreview(null)
    setResultado(null)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/embargos/planilla/preview', {
        method: 'POST',
        headers: { 'x-archivo-nombre': encodeURIComponent(file.name) },
        body: file,
      })
      const respuesta = (await response.json()) as AnalizarPlanillaResult
      if (!response.ok || !respuesta.ok) {
        setError(respuesta.error ?? 'No se pudo procesar la planilla.')
        return
      }
      setPreview(respuesta)
      setNotice(
        `Planilla procesada: ${respuesta.resumen.total} DNI(s) para ${periodoLabel(respuesta.periodo ?? '')}.`,
      )
    } catch {
      setError('No se pudo procesar la planilla. Verificá el archivo e intentá de nuevo.')
    } finally {
      setProcesando(false)
    }
  }

  const confirmar = async () => {
    if (!preview?.periodo) return
    const items = preview.items
      .filter((item) => item.accion === 'crear' || item.accion === 'actualizar')
      .map((item) => ({
        dni: item.dni,
        retencionSueldo: item.retencionSueldo,
        retencionRefrigerio: item.retencionRefrigerio,
      }))
    const noImputacionIds = preview.items
      .filter((item) => item.accion === 'no_imputacion' && item.idEmbargo)
      .map((item) => item.idEmbargo as number)

    if (items.length === 0 && noImputacionIds.length === 0) {
      setError('No hay filas válidas para importar.')
      return
    }

    setImportando(true)
    setError(null)
    try {
      const respuesta = await importarRetencionesPlanilla(preview.periodo, items, noImputacionIds)
      if (!respuesta.ok) {
        setError(respuesta.error ?? 'No se pudieron importar las retenciones.')
        return
      }
      setResultado(respuesta)
      setNotice(
        `Importación de ${periodoLabel(respuesta.periodo ?? preview.periodo)}: ${respuesta.creadas} creadas, ${respuesta.actualizadas} actualizadas, ${respuesta.marcadosNoImputacion} marcadas como No imputación, ${respuesta.omitidas} omitidas por ${formatMoney(respuesta.importe)}.`,
      )
      setPreview(null)
      setArchivo(null)
      if (fileRef.current) fileRef.current.value = ''
      onImported?.()
    } catch {
      setError('No se pudieron importar las retenciones. Verificá la conexión.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <FileSpreadsheet className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">Importar retenciones desde planilla (Excel)</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Lee la planilla de liquidación, toma las filas de <strong>Sueldo</strong> y <strong>Refrigerio REM</strong> con
            código <strong>8500 (Embargos Varios)</strong> y prepara la retención del período para cada DNI con embargo
            activo. Si el embargo está cancelado y aparece una cuota nueva, queda marcado como{' '}
            <strong>No imputación</strong> para su revisión.
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
        {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Planilla</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm"
              onChange={seleccionarArchivo}
              disabled={procesando || importando}
              className="block w-full cursor-pointer rounded-md border border-slate-200 bg-white text-xs text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1e3a8a] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#172554] disabled:opacity-60"
            />
            {archivo && (
              <span className="text-[10px] text-slate-400">
                {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
          </div>

          <div className="flex gap-2 pb-0.5">
            <button
              type="button"
              onClick={() => void procesar()}
              disabled={!archivo || procesando || importando}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {procesando ? 'Procesando...' : 'Procesar planilla'}
            </button>
            {(archivo || preview) && (
              <button
                type="button"
                onClick={limpiar}
                disabled={procesando || importando}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {procesando && (
          <p className="text-[10px] text-slate-400">
            La planilla se procesa en el servidor; puede tardar alrededor de 30 segundos en archivos de más de
            300.000 filas.
          </p>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3 lg:grid-cols-7">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-slate-400">Período</p>
                <p className="text-sm font-bold text-slate-800">{periodoLabel(preview.periodo ?? '')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-slate-400">DNI</p>
                <p className="text-sm font-bold text-slate-800">{preview.resumen.total}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-emerald-600">A crear</p>
                <p className="text-sm font-bold text-emerald-700">{preview.resumen.crear}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-blue-600">A actualizar</p>
                <p className="text-sm font-bold text-blue-700">{preview.resumen.actualizar}</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-violet-600">No imputación</p>
                <p className="text-sm font-bold text-violet-700">{preview.resumen.noImputacion}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-rose-600">Con error</p>
                <p className="text-sm font-bold text-rose-700">{preview.resumen.errores}</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2">
                <p className="text-[9px] uppercase tracking-wide text-slate-500">Importe a retener</p>
                <p className="truncate font-mono text-sm font-bold text-slate-800" title={formatMoney(preview.resumen.importe)}>
                  {formatMoney(preview.resumen.importe)}
                </p>
              </div>
            </div>

            {preview.advertencias.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                {preview.advertencias.map((advertencia) => (
                  <p key={advertencia}>• {advertencia}</p>
                ))}
              </div>
            )}

            {preview.resumen.noImputacion > 0 && (
              <Banner tone="warning">
                {preview.resumen.noImputacion} DNI(s) tienen un embargo cancelado con una cuota nueva por{' '}
                {formatMoney(preview.resumen.importeNoImputacion)}. Al confirmar, esos embargos pasan al estado{' '}
                <strong>No imputación</strong> para que los revises; la retención no se carga.
              </Banner>
            )}

            {preview.resumen.errores > 0 && (
              <Banner
                tone={
                  preview.resumen.crear + preview.resumen.actualizar + preview.resumen.noImputacion === 0
                    ? 'warning'
                    : 'info'
                }
              >
                {preview.resumen.crear + preview.resumen.actualizar + preview.resumen.noImputacion === 0
                  ? 'Ninguna de las filas se puede procesar: revisá que los agentes tengan un embargo activo y saldo pendiente.'
                  : `${preview.resumen.errores} fila(s) con error no se van a importar. Podés revisarlas en la columna «Acción».`}
              </Banner>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar por DNI, agente o expediente..."
                  className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-700 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">
                  {filtrados.length} de {preview.items.length} fila(s)
                </span>
                <button
                  type="button"
                  onClick={() => void confirmar()}
                  disabled={
                    importando ||
                    procesando ||
                    preview.resumen.crear +
                      preview.resumen.actualizar +
                      preview.resumen.noImputacion ===
                      0
                  }
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {importando ? 'Importando...' : 'Confirmar importación'}
                </button>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[1150px] text-[11px]">
                <thead className="sticky top-0 z-10 bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left">DNI</th>
                    <th className="px-2 py-2 text-left">Empleado</th>
                    <th className="px-2 py-2 text-left">Procesos</th>
                    <th className="px-2 py-2 text-left">Código / Concepto</th>
                    <th className="px-2 py-2 text-right">Ret. Sueldo</th>
                    <th className="px-2 py-2 text-right">Ret. Refrig.</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-left">Período</th>
                    <th className="px-2 py-2 text-left">Embargo</th>
                    <th className="px-2 py-2 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtrados.map((item) => (
                    <tr
                      key={`${item.dni}-${item.periodo}`}
                      className={
                        item.accion === 'error'
                          ? 'bg-rose-50/40'
                          : item.accion === 'no_imputacion'
                            ? 'bg-violet-50/40'
                            : 'hover:bg-slate-50'
                      }
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-600">{item.dni}</td>
                      <td className="px-2 py-1.5 font-semibold text-slate-700">{item.agente || item.nombre}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">
                        {item.procesos.join(' + ') || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">
                        8500 · {item.conceptos.join(' / ') || 'Embargos Varios'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono">
                        <Money value={item.retencionSueldo} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono">
                        <Money value={item.retencionRefrigerio} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono font-bold text-[#1e3a8a]">
                        <Money value={item.total} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{periodoLabel(item.periodo)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-500">
                        {item.expediente || '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <AccionBadge item={item} />
                        {item.error && <p className="mt-1 text-[10px] leading-tight text-rose-600">{item.error}</p>}
                        {item.accion === 'no_imputacion' && (
                          <p className="mt-1 text-[10px] leading-tight text-violet-600">
                            El embargo cancelado pasará a No imputación para revisión.
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-xs text-slate-500">
                        No hay filas que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {resultado && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
            <p className="font-semibold">
              Importación de {periodoLabel(resultado.periodo ?? '')} finalizada: {resultado.creadas} creadas,{' '}
              {resultado.actualizadas} actualizadas, {resultado.marcadosNoImputacion} marcadas como No imputación,{' '}
              {resultado.omitidas} omitidas.
            </p>
            {resultado.errores.length > 0 && (
              <ul className="mt-1 max-h-32 overflow-auto text-[10px] text-rose-700">
                {resultado.errores.map((mensaje) => (
                  <li key={mensaje}>• {mensaje}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
