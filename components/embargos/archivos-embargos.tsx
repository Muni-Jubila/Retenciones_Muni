'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  FolderUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  exportarBackup,
  reindexarSaldos,
  restaurarBackup,
  verificarIntegridad,
  type Inconsistencia,
  type RestauracionResult,
} from '@/app/actions/embargos'
import { downloadTextFile, todayFileSuffix } from '@/lib/embargos'
import { Banner, ConfirmDialog } from '@/components/embargos/ui'

export default function ArchivosEmbargos() {
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [reindexados, setReindexados] = useState<number | null>(null)
  const [verificacion, setVerificacion] = useState<{
    revisados: number
    inconsistencias: Inconsistencia[]
  } | null>(null)

  const [archivoNombre, setArchivoNombre] = useState('')
  const [backupPendiente, setBackupPendiente] = useState<string | null>(null)
  const [restauracion, setRestauracion] = useState<RestauracionResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const runReindexar = async () => {
    setRunning('indexar')
    setReindexados(null)
    try {
      const resultado = await reindexarSaldos()
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudieron reindexar los saldos.')
        return
      }
      setReindexados(resultado.procesados)
      setNotice(`Se recalcularon los saldos de ${resultado.procesados} embargos.`)
    } catch {
      setError('No se pudieron reindexar los saldos.')
    } finally {
      setRunning(null)
    }
  }

  const runBackup = async () => {
    setRunning('backup')
    try {
      const resultado = await exportarBackup()
      if (!resultado.ok || !resultado.contenido) {
        setError(resultado.error ?? 'No se pudo generar el backup.')
        return
      }
      downloadTextFile(
        resultado.nombre ?? `backup-embargos-${todayFileSuffix()}.json`,
        resultado.contenido,
        'application/json;charset=utf-8',
        false,
      )
      setNotice('Backup generado y descargado en formato JSON.')
    } catch {
      setError('No se pudo generar el backup.')
    } finally {
      setRunning(null)
    }
  }

  const runVerificar = async () => {
    setRunning('verificar')
    setVerificacion(null)
    try {
      const resultado = await verificarIntegridad()
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo verificar la integridad.')
        return
      }
      setVerificacion({ revisados: resultado.revisados, inconsistencias: resultado.inconsistencias })
      setNotice(
        resultado.inconsistencias.length === 0
          ? `Verificación completa: ${resultado.revisados} embargos sin inconsistencias.`
          : `Verificación completa: ${resultado.inconsistencias.length} inconsistencias detectadas.`,
      )
    } catch {
      setError('No se pudo verificar la integridad.')
    } finally {
      setRunning(null)
    }
  }

  const seleccionarArchivo = async (file: File | null) => {
    if (!file) return
    setRestauracion(null)
    setArchivoNombre(file.name)
    try {
      const text = await file.text()
      setBackupPendiente(text)
    } catch {
      setError('No se pudo leer el archivo seleccionado.')
    }
  }

  const confirmarRestauracion = async () => {
    if (!backupPendiente) return
    setRunning('restaurar')
    try {
      const resultado = await restaurarBackup(backupPendiente)
      setRestauracion(resultado)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo restaurar el backup.')
        return
      }
      setNotice(
        `Restauración finalizada: ${resultado.creados} embargos creados, ${resultado.omitidos} omitidos.`,
      )
    } catch {
      setError('No se pudo restaurar el backup.')
    } finally {
      setRunning(null)
      setBackupPendiente(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Archivos y mantenimiento</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Equivalente al menú legacy “ARCHIVOS”: indexación de saldos, restauración de backups y respaldo completo
          de embargos y retenciones. La indexación recalcula todos los saldos desde la deuda original.
        </p>
      </div>

      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Indexar */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-[#1e3a8a]">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Indexar / recalcular</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                Recalcula el saldo de cada retención en orden cronológico y actualiza el estado de los embargos saldados.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
            <button
              type="button"
              onClick={() => void runReindexar()}
              disabled={running !== null}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
            >
              {running === 'indexar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reindexar saldos
            </button>
            {reindexados !== null && (
              <p className="text-center text-[10px] font-semibold text-emerald-700">{reindexados} embargos procesados.</p>
            )}
          </div>
        </div>

        {/* Restaurar */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
              <FolderUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Restaurar</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                Importa un backup JSON generado por este sistema. Sólo agrega embargos de agentes existentes y omite los expedientes ya cargados.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => void seleccionarArchivo(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-500 file:mr-3 file:border-0 file:bg-[#1e3a8a] file:px-3 file:py-2 file:text-[10px] file:font-semibold file:text-white hover:file:bg-[#172554]"
            />
            {archivoNombre && <p className="truncate text-[10px] text-slate-500">Archivo: {archivoNombre}</p>}
            {restauracion && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
                <p><strong>{restauracion.creados}</strong> creados · <strong>{restauracion.omitidos}</strong> omitidos.</p>
                {restauracion.errores.length > 0 && (
                  <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-rose-600">
                    {restauracion.errores.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Backup */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
              <DatabaseBackup className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Backup</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                Descarga un JSON completo con todos los embargos, datos del agente y retenciones mensuales.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
            <button
              type="button"
              onClick={() => void runBackup()}
              disabled={running !== null}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {running === 'backup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar backup JSON
            </button>
            <p className="text-center text-[10px] text-slate-400">
              <FileJson className="mr-1 inline h-3 w-3" />
              Formato versión 1 compatible con Restaurar.
            </p>
          </div>
        </div>
      </div>

      {/* Integridad */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-[#1e3a8a]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Verificar integridad</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Detecta saldos inconsistentes, saldos negativos y embargos activos sin retenciones.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void runVerificar()}
            disabled={running !== null}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {running === 'verificar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verificar
          </button>
        </div>

        <div className="p-4">
          {verificacion === null ? (
            <p className="text-[11px] text-slate-400">Ejecutá la verificación para revisar los saldos y estados.</p>
          ) : verificacion.inconsistencias.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {verificacion.revisados} embargos revisados. No se detectaron inconsistencias.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                {verificacion.inconsistencias.length} inconsistencias en {verificacion.revisados} embargos revisados.
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-slate-100 uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left">DNI</th>
                      <th className="px-2 py-1.5 text-left">Agente</th>
                      <th className="px-2 py-1.5 text-left">Expediente</th>
                      <th className="px-2 py-1.5 text-left">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {verificacion.inconsistencias.map((item) => (
                      <tr key={`${item.idEmbargo}-${item.detalle}`}>
                        <td className="px-2 py-1.5 font-mono text-slate-600">{item.dni || '—'}</td>
                        <td className="px-2 py-1.5 font-semibold text-slate-700">{item.agente}</td>
                        <td className="px-2 py-1.5 font-mono text-slate-500">{item.expediente || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{item.detalle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => void runReindexar()}
                disabled={running !== null}
                className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reindexar saldos para corregir
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(backupPendiente)}
        title="Restaurar backup"
        description={
          <>
            Se importará el archivo <strong>{archivoNombre}</strong>. Sólo se crearán embargos de agentes existentes y se
            omitirán los expedientes duplicados. Esta acción agrega registros y no elimina los actuales.
          </>
        }
        confirmLabel="Restaurar"
        loading={running === 'restaurar'}
        onCancel={() => {
          setBackupPendiente(null)
          if (inputRef.current) inputRef.current.value = ''
          setArchivoNombre('')
        }}
        onConfirm={() => void confirmarRestauracion()}
      />
    </div>
  )
}
