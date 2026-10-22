'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FilePlus2,
  Hash,
  History,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Scale,
  Search,
  Trash2,
  UserRoundSearch,
  Wallet,
  X,
} from 'lucide-react'
import {
  actualizarEmbargo,
  actualizarRetencion,
  cambiarEstadoEmbargo,
  crearEmbargo,
  crearRetencion,
  eliminarEmbargo,
  eliminarRetencion,
  listarEmbargosDeAgente,
  listarRetenciones,
} from '@/app/actions/embargos'
import { buscarEmpleados, getEmpleadoPorId } from '@/app/actions/empleados'
import type { Empleado } from '@/lib/empleados'
import {
  ESTADOS_EMBARGO,
  formatMoney,
  moneyToInput,
  parseMoneyInput,
  periodoActual,
  periodoLabel,
  resumenEstados,
  roundMoney,
  type Embargo,
  type EmbargoInput,
  type EstadoEmbargo,
  type RetencionEmbargo,
} from '@/lib/embargos'
import {
  Banner,
  ConfirmDialog,
  EmptyState,
  EstadoBadge,
  LoadingLine,
  Money,
  MoneyField,
  SelectField,
  TextField,
} from '@/components/embargos/ui'
import EmbargoForm from '@/components/embargos/embargo-form'

interface FichaAgenteProps {
  initialAgenteId?: number | null
  onInitialConsumed?: () => void
}

type Modo = 'ver' | 'nuevo' | 'editar'

function DetailItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-xs font-medium text-slate-700">{value || '—'}</p>
    </div>
  )
}

function RetencionForm({
  embargo,
  initial,
  saldoBase,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  embargo: Embargo
  initial?: RetencionEmbargo | null
  saldoBase: number
  saving: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (input: {
    periodo: string
    sueldo: string
    refrigerio: string
    retencionMensual: string
    devolucion: string
    observaciones: string
  }) => void
}) {
  const [periodo, setPeriodo] = useState(initial?.periodo ?? periodoActual())
  const [sueldo, setSueldo] = useState(initial ? moneyToInput(initial.sueldo) : '')
  const [refrigerio, setRefrigerio] = useState(initial ? moneyToInput(initial.refrigerio) : '')
  const [retencion, setRetencion] = useState(
    initial ? moneyToInput(initial.retencionMensual) : moneyToInput(embargo.importeMensual || saldoBase),
  )
  const [devolucion, setDevolucion] = useState(initial ? moneyToInput(initial.devolucion) : '')
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? '')

  const retencionNum = parseMoneyInput(retencion)
  const devolucionNum = parseMoneyInput(devolucion)
  const saldoResultante = roundMoney(saldoBase - retencionNum + devolucionNum)
  const excedeSaldo = retencionNum > saldoBase + devolucionNum

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#1e3a8a]">
          <History className="h-3.5 w-3.5" />
          {initial ? `Modificar retención · ${periodoLabel(initial.periodo)}` : 'Registrar retención mensual'}
        </h4>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-slate-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && <div className="mb-2"><Banner tone="error">{error}</Banner></div>}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
        <TextField label="Período" value={periodo} onChange={setPeriodo} type="month" />
        <MoneyField label="Sueldo" value={sueldo} onChange={setSueldo} />
        <MoneyField label="Refrigerio" value={refrigerio} onChange={setRefrigerio} />
        <MoneyField label="Retención mensual" value={retencion} onChange={setRetencion} />
        <MoneyField label="Devolución" value={devolucion} onChange={setDevolucion} />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_auto]">
        <TextField label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Opcional" maxLength={500} />
        <div className="flex flex-col justify-end">
          <div
            className={`rounded-md border px-3 py-1.5 text-right text-xs ${
              excedeSaldo ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-wider opacity-70">Saldo resultante</span>
            <span className="font-mono font-bold">{formatMoney(Math.max(saldoResultante, 0))}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500">
          Saldo disponible: <span className="font-mono font-bold text-slate-700">{formatMoney(saldoBase)}</span>. El servidor recalcula todos los saldos al guardar.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !periodo}
            onClick={() => onSubmit({ periodo, sueldo, refrigerio, retencionMensual: retencion, devolucion, observaciones })}
            className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? 'Guardando...' : 'Guardar retención'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FichaAgente({ initialAgenteId, onInitialConsumed }: FichaAgenteProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(false)
  const [resultados, setResultados] = useState<Empleado[]>([])
  const [sinResultados, setSinResultados] = useState(false)

  const [agente, setAgente] = useState<Empleado | null>(null)
  const [embargos, setEmbargos] = useState<Embargo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [retenciones, setRetenciones] = useState<RetencionEmbargo[]>([])
  const [loadingRetenciones, setLoadingRetenciones] = useState(false)

  const [modo, setModo] = useState<Modo>('ver')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formField, setFormField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [showRetencionForm, setShowRetencionForm] = useState(false)
  const [retencionEdit, setRetencionEdit] = useState<RetencionEmbargo | null>(null)
  const [savingRetencion, setSavingRetencion] = useState(false)
  const [retencionError, setRetencionError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [estadoConfirm, setEstadoConfirm] = useState<{ id: number; estado: EstadoEmbargo } | null>(null)
  const [motivoEstado, setMotivoEstado] = useState('')
  const [embargoDelete, setEmbargoDelete] = useState<number | null>(null)
  const [retencionDelete, setRetencionDelete] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const selected = useMemo(
    () => embargos.find((item) => item.id === selectedId) ?? null,
    [embargos, selectedId],
  )
  const resumen = useMemo(() => resumenEstados(embargos), [embargos])

  const saldoBaseRetencion = useMemo(() => {
    if (!selected) return 0
    if (!retencionEdit) return selected.saldoActual
    const anteriores = retenciones.filter(
      (item) => item.periodo < retencionEdit.periodo && item.id !== retencionEdit.id,
    )
    return roundMoney(
      anteriores.reduce(
        (acc, item) => acc - item.retencionMensual + item.devolucion,
        selected.deuda,
      ),
    )
  }, [selected, retencionEdit, retenciones])

  const recargarEmbargos = async (idAgente: number, preferId?: number) => {
    const lista = await listarEmbargosDeAgente(idAgente)
    setEmbargos(lista)
    setSelectedId((prev) => {
      if (preferId && lista.some((item) => item.id === preferId)) return preferId
      if (prev && lista.some((item) => item.id === prev)) return prev
      return lista[0]?.id ?? null
    })
  }

  const cargarAgente = async (empleado: Empleado) => {
    setAgente(empleado)
    setResultados([])
    setSinResultados(false)
    setQuery('')
    setModo('ver')
    setSelectedId(null)
    setEmbargos([])
    setRetenciones([])
    setError(null)
    setNotice(null)
    setLoadingAgent(true)
    try {
      await recargarEmbargos(empleado.id)
    } catch {
      setError('No se pudieron cargar los embargos del agente.')
    } finally {
      setLoadingAgent(false)
    }
  }

  useEffect(() => {
    if (!initialAgenteId) return
    let active = true
    setLoadingAgent(true)
    getEmpleadoPorId(initialAgenteId)
      .then((empleado) => {
        if (!active) return
        if (empleado) void cargarAgente(empleado)
        else setError('No se encontró el agente solicitado.')
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el agente solicitado.')
      })
      .finally(() => {
        if (active) {
          setLoadingAgent(false)
          onInitialConsumed?.()
        }
      })
    return () => {
      active = false
    }
    // El id inicial sólo se consume una vez; cargarAgente se recrea con el estado del componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAgenteId])

  useEffect(() => {
    if (!selectedId) {
      setRetenciones([])
      return
    }
    let active = true
    setLoadingRetenciones(true)
    listarRetenciones(selectedId)
      .then((filas) => {
        if (active) setRetenciones(filas)
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar las retenciones del embargo.')
      })
      .finally(() => {
        if (active) setLoadingRetenciones(false)
      })
    return () => {
      active = false
    }
  }, [selectedId, refreshKey])

  const handleSearch = async () => {
    const texto = query.trim()
    if (!texto) return
    setSearching(true)
    setError(null)
    setSinResultados(false)
    setResultados([])
    try {
      const encontrados = await buscarEmpleados(texto)
      if (encontrados.length === 0) {
        setSinResultados(true)
      } else if (encontrados.length === 1) {
        await cargarAgente(encontrados[0])
      } else {
        setResultados(encontrados)
      }
    } catch {
      setError('Error al buscar el agente. Verifique la conexión con la base de datos.')
    } finally {
      setSearching(false)
    }
  }

  const handleSaveEmbargo = async (input: EmbargoInput) => {
    if (!agente) return
    setSaving(true)
    setFormError(null)
    setFormField(null)
    try {
      const resultado =
        modo === 'editar' && selected
          ? await actualizarEmbargo(selected.id, input)
          : await crearEmbargo(input)

      if (!resultado.ok) {
        setFormError(resultado.error ?? 'No se pudo guardar el embargo.')
        setFormField(resultado.field ?? null)
        return
      }

      setModo('ver')
      setNotice(modo === 'editar' ? 'Embargo modificado correctamente.' : 'Embargo creado correctamente.')
      await recargarEmbargos(agente.id, resultado.embargo?.id)
      setRefreshKey((key) => key + 1)
    } catch {
      setFormError('Error al guardar el embargo. Verifique la conexión.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmEstado = async () => {
    if (!estadoConfirm) return
    setActionLoading(true)
    try {
      const resultado = await cambiarEstadoEmbargo(
        estadoConfirm.id,
        estadoConfirm.estado,
        motivoEstado.trim() || undefined,
      )
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo cambiar el estado.')
        return
      }
      setNotice(`Estado actualizado a ${ESTADOS_EMBARGO.find((item) => item.value === estadoConfirm.estado)?.label}.`)
      if (agente) await recargarEmbargos(agente.id, estadoConfirm.id)
      setRefreshKey((key) => key + 1)
    } catch {
      setError('No se pudo cambiar el estado del embargo.')
    } finally {
      setActionLoading(false)
      setEstadoConfirm(null)
      setMotivoEstado('')
    }
  }

  const handleDeleteEmbargo = async () => {
    if (!embargoDelete || !agente) return
    setActionLoading(true)
    try {
      const resultado = await eliminarEmbargo(embargoDelete)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo eliminar el embargo.')
        return
      }
      setNotice('Embargo eliminado del registro.')
      setModo('ver')
      setSelectedId(null)
      await recargarEmbargos(agente.id)
    } catch {
      setError('No se pudo eliminar el embargo.')
    } finally {
      setActionLoading(false)
      setEmbargoDelete(null)
    }
  }

  const openNuevo = () => {
    setModo('nuevo')
    setFormError(null)
    setFormField(null)
    setNotice(null)
  }

  const openEditar = () => {
    if (!selected) return
    setModo('editar')
    setFormError(null)
    setFormField(null)
    setNotice(null)
    setShowRetencionForm(false)
  }

  const openEditarRetencion = (retencion: RetencionEmbargo) => {
    setRetencionEdit(retencion)
    setRetencionError(null)
    setShowRetencionForm(true)
  }

  const handleSaveRetencion = async (input: {
    periodo: string
    sueldo: string
    refrigerio: string
    retencionMensual: string
    devolucion: string
    observaciones: string
  }) => {
    if (!selected || !agente) return
    setSavingRetencion(true)
    setRetencionError(null)
    try {
      const resultado = retencionEdit
        ? await actualizarRetencion(retencionEdit.id, input)
        : await crearRetencion({ idEmbargo: selected.id, ...input })

      if (!resultado.ok) {
        setRetencionError(resultado.error ?? 'No se pudo guardar la retención.')
        return
      }

      setShowRetencionForm(false)
      setRetencionEdit(null)
      setNotice(retencionEdit ? 'Retención modificada correctamente.' : 'Retención registrada correctamente.')
      await recargarEmbargos(agente.id, selected.id)
      setRefreshKey((key) => key + 1)
    } catch {
      setRetencionError('Error al guardar la retención. Verifique la conexión.')
    } finally {
      setSavingRetencion(false)
    }
  }

  const handleDeleteRetencion = async () => {
    if (!retencionDelete || !agente || !selected) return
    setActionLoading(true)
    try {
      const resultado = await eliminarRetencion(retencionDelete)
      if (!resultado.ok) {
        setError(resultado.error ?? 'No se pudo eliminar la retención.')
        return
      }
      setNotice('Retención eliminada y saldos recalculados.')
      await recargarEmbargos(agente.id, selected.id)
      setRefreshKey((key) => key + 1)
    } catch {
      setError('No se pudo eliminar la retención.')
    } finally {
      setActionLoading(false)
      setRetencionDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]">
              Buscar agente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) void handleSearch()
                }}
                placeholder="Ingrese DNI, apellido o nombre del agente..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching || !query.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          Desde la ficha podés cargar el embargo completo, sus retenciones mensuales y consultar el saldo sin cambiar de pantalla.
        </p>
      </div>

      {sinResultados && (
        <Banner tone="warning" onClose={() => setSinResultados(false)}>
          No se encontró ningún agente con ese dato. Probá con el DNI completo o parte del apellido.
        </Banner>
      )}
      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}
      {loadingAgent && <LoadingLine text="Cargando agente y embargos..." />}

      {/* Resultados de búsqueda */}
      {resultados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1e3a8a]">
              <UserRoundSearch className="h-3.5 w-3.5" />
              {resultados.length} agentes encontrados
            </span>
            <button type="button" onClick={() => setResultados([])} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {resultados.map((empleado) => (
              <button
                key={empleado.id}
                type="button"
                onClick={() => void cargarAgente(empleado)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#1e3a8a]">
                  {(empleado.apellido || empleado.nombre || '?').slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{empleado.nombreCompleto}</p>
                  <p className="truncate text-[10px] text-slate-500">
                    DNI {empleado.dni || '—'} · {empleado.programa || 'Sin programa'} · {empleado.cargo || 'Sin cargo'}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[#1e3a8a]">Seleccionar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!agente && !loadingAgent && resultados.length === 0 && (
        <EmptyState
          icon={<Scale className="h-6 w-6" />}
          title="Ficha de embargos del agente"
          description="Buscá un agente por DNI o apellido. En una sola pantalla vas a ver sus embargos, el detalle del expediente, las retenciones mes a mes y el saldo pendiente."
        />
      )}

      {agente && (
        <>
          {/* Cabecera del agente */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-[#172554] to-[#1e3a8a] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-black">
                  {(agente.apellido || agente.nombre || '?').slice(0, 1)}
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">{agente.nombreCompleto}</h2>
                  <p className="text-[11px] text-blue-200">
                    DNI {agente.dni || '—'} · CUIL {agente.cuil || '—'} · {agente.programa || 'Sin programa'} · Cargo {agente.cargo || '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    agente.estadoActivo
                      ? 'border-emerald-300 bg-emerald-500/30 text-emerald-100'
                      : 'border-rose-300 bg-rose-500/30 text-rose-100'
                  }`}
                >
                  {agente.estadoActivo ? 'Agente activo' : 'Agente inactivo'}
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={openNuevo}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Nuevo embargo
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs md:grid-cols-4">
              <DetailItem label="Repartición" value={agente.secretaria} />
              <DetailItem label="Programa" value={agente.programa} />
              <DetailItem label="Cargo" value={agente.cargo} />
              <DetailItem label="Antigüedad" value={agente.antiguedadRecibo} />
            </div>
          </div>

          {/* Resumen de embargos */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Embargos', value: String(resumen.total), icon: Scale, tone: 'text-[#1e3a8a] bg-blue-50' },
              { label: 'Activos', value: String(resumen.activos), icon: BadgeCheck, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'En espera', value: String(resumen.espera), icon: CalendarClock, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Deuda total', value: formatMoney(resumen.deuda), icon: Wallet, tone: 'text-slate-700 bg-slate-100' },
              { label: 'Retenido', value: formatMoney(resumen.retenido), icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Saldo pendiente', value: formatMoney(resumen.saldo), icon: Hash, tone: 'text-rose-700 bg-rose-50' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{item.label}</span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md ${item.tone}`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-sm font-bold text-slate-800" title={item.value}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Formulario inline */}
          {modo !== 'ver' && (
            <EmbargoForm
              key={modo === 'editar' ? `edit-${selected?.id}` : 'nuevo'}
              agente={agente}
              initial={modo === 'editar' ? selected : null}
              saving={saving}
              error={formError}
              field={formField}
              onCancel={() => setModo('ver')}
              onSubmit={(input) => void handleSaveEmbargo(input)}
            />
          )}

          {/* Lista de embargos */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1e3a8a]">
                <Scale className="h-3.5 w-3.5" />
                Embargos del agente
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600">{embargos.length}</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] text-slate-400 md:inline">Hacé clic en una fila para ver el detalle completo</span>
                {selected && modo === 'ver' && (
                  <button
                    type="button"
                    onClick={openEditar}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Pencil className="h-3 w-3" />
                    Modificar
                  </button>
                )}
              </div>
            </div>

            {embargos.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<FilePlus2 className="h-6 w-6" />}
                  title="El agente no tiene embargos cargados"
                  description="Usá el botón “Nuevo embargo” para registrar los autos, expediente, juzgado, deuda y retención mensual."
                  action={
                    <button
                      type="button"
                      onClick={openNuevo}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Cargar primer embargo
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-xs">
                  <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="w-10 px-2 py-2 text-center">M</th>
                      <th className="px-3 py-2 text-left">Autos</th>
                      <th className="px-3 py-2 text-left">Expediente</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-right">Deuda</th>
                      <th className="px-3 py-2 text-right">Retención</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {embargos.map((embargo) => {
                      const activo = embargo.id === selectedId
                      return (
                        <tr
                          key={embargo.id}
                          onClick={() => {
                            setSelectedId(embargo.id)
                            setModo('ver')
                            setShowRetencionForm(false)
                          }}
                          className={`cursor-pointer transition ${activo ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-black ${
                                activo ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ESTADOS_EMBARGO.find((item) => item.value === embargo.estado)?.letra ?? '?'}
                            </span>
                          </td>
                          <td className="max-w-[260px] truncate px-3 py-2 font-semibold text-slate-800" title={embargo.autos}>
                            {embargo.autos || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{embargo.expediente || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">{embargo.fechaExpediente || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={embargo.deuda} className="text-slate-700" /></td>
                          <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={embargo.importeMensual} className="text-slate-700" /></td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <Money value={embargo.saldoActual} className={embargo.saldoActual > 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-600'} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2"><EstadoBadge estado={embargo.estado} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detalle del embargo seleccionado */}
          {selected && modo === 'ver' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">Detalle del embargo</h3>
                      <EstadoBadge estado={selected.estado} />
                      {selected.cantidadRetenciones > 0 && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                          {selected.cantidadRetenciones} retención{selected.cantidadRetenciones !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {selected.autos || 'Sin autos'} · Expediente {selected.expediente || 's/n'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                    <select
                      value=""
                      onChange={(event) => {
                        const estado = event.target.value as EstadoEmbargo
                        if (estado) {
                          setMotivoEstado(estado === 'CANCELADO' ? 'Deuda cancelada' : '')
                          setEstadoConfirm({ id: selected.id, estado })
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 focus:border-[#1e3a8a] focus:outline-none"
                      title="Cambiar estado del embargo"
                    >
                      <option value="">Cambiar estado...</option>
                      {ESTADOS_EMBARGO.filter((item) => item.value !== selected.estado).map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.letra} · {item.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={openEditar}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#172554]"
                    >
                      <Pencil className="h-3 w-3" />
                      Modificar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbargoDelete(selected.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 px-4 py-4 md:grid-cols-4">
                  <DetailItem label="Autos" value={selected.autos} className="col-span-2 md:col-span-4" />
                  <DetailItem label="Expediente N°" value={<span className="font-mono">{selected.expediente}</span>} />
                  <DetailItem label="Fecha expediente" value={selected.fechaExpediente} />
                  <DetailItem label="Cuenta N°" value={<span className="font-mono">{selected.cuenta}</span>} />
                  <DetailItem label="Sucursal" value={selected.sucursal} />
                  <DetailItem label="Juez de" value={selected.juez} />
                  <DetailItem label="Inst. y" value={selected.instancia} />
                  <DetailItem label="Nom." value={selected.nomenclatura} />
                  <DetailItem label="T." value={selected.tipoProceso} />
                  <DetailItem label="Secretaría judicial" value={selected.secretaria} />
                  <DetailItem label="Marca especial" value={selected.marcaEspecial} />
                  <DetailItem label="Fecha de alta" value={selected.fechaAlta} />
                  <DetailItem label="Fecha de baja" value={selected.fechaBaja} />
                  <DetailItem label="Motivo de baja" value={selected.motivoBaja} className="col-span-2" />

                  <div className="col-span-2 mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Deuda</p>
                        <Money value={selected.deuda} className="text-sm font-bold text-slate-800" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Retención mensual</p>
                        <Money value={selected.importeMensual} className="text-sm font-bold text-slate-800" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total retenido</p>
                        <Money value={selected.totalRetenido} className="text-sm font-bold text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Devoluciones</p>
                        <Money value={selected.totalDevuelto} className="text-sm font-bold text-blue-700" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Saldo pendiente</p>
                        <Money value={selected.saldoActual} className={`text-sm font-black ${selected.saldoActual > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${Math.min(100, selected.deuda > 0 ? (selected.totalRetenido / selected.deuda) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <DetailItem label="Observaciones" value={selected.observaciones} className="col-span-2 md:col-span-4" />
                </div>
              </div>

              {/* Retenciones */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1e3a8a]">
                    <History className="h-3.5 w-3.5" />
                    Detalle de retenciones
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600">{retenciones.length}</span>
                  </h3>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setRetencionEdit(null)
                        setRetencionError(null)
                        setShowRetencionForm(true)
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#172554]"
                    >
                      <CalendarPlus className="h-3 w-3" />
                      Agregar retención
                    </button>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {showRetencionForm && (
                    <RetencionForm
                      key={retencionEdit ? `edit-${retencionEdit.id}` : `new-${selected.id}`}
                      embargo={selected}
                      initial={retencionEdit}
                      saldoBase={saldoBaseRetencion}
                      saving={savingRetencion}
                      error={retencionError}
                      onCancel={() => {
                        setShowRetencionForm(false)
                        setRetencionEdit(null)
                        setRetencionError(null)
                      }}
                      onSubmit={(input) => void handleSaveRetencion(input)}
                    />
                  )}

                  {loadingRetenciones ? (
                    <LoadingLine text="Cargando retenciones..." />
                  ) : retenciones.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
                      <p className="text-xs font-semibold text-slate-600">Todavía no hay retenciones registradas.</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Agregá el primer mes o usá “Actualizar → Imputar sueldo/refrigerio” para generarlas en lote.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="w-9 px-2 py-2 text-center">M</th>
                            <th className="px-3 py-2 text-left">Mes Ret.</th>
                            <th className="px-3 py-2 text-right">Refrig.</th>
                            <th className="px-3 py-2 text-right">Sueldo</th>
                            <th className="px-3 py-2 text-right">R. Mensual</th>
                            <th className="px-3 py-2 text-right">Saldo</th>
                            <th className="px-3 py-2 text-right">Dev.</th>
                            <th className="px-3 py-2 text-left">Observaciones</th>
                            <th className="w-16 px-2 py-2 text-center print:hidden">Acc.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {retenciones.map((retencion) => (
                            <tr key={retencion.id} className="transition hover:bg-slate-50">
                              <td className="px-2 py-2 text-center">
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-black ${retencion.retencionMensual > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {retencion.retencionMensual > 0 ? 'A' : 'D'}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">{periodoLabel(retencion.periodo)}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={retencion.refrigerio} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={retencion.sueldo} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-[#1e3a8a]"><Money value={retencion.retencionMensual} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-rose-600"><Money value={retencion.saldo} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={retencion.devolucion} /></td>
                              <td className="max-w-[220px] truncate px-3 py-2 text-slate-500" title={retencion.observaciones}>{retencion.observaciones || '—'}</td>
                              <td className="px-2 py-2 print:hidden">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditarRetencion(retencion)}
                                    className="rounded p-1 text-slate-400 transition hover:bg-blue-50 hover:text-[#1e3a8a]"
                                    title="Modificar retención"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRetencionDelete(retencion.id)}
                                    className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                    title="Eliminar retención"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 text-[10px] font-bold text-slate-600">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wider">Totales</td>
                            <td className="px-3 py-2 text-right"><Money value={selected.totalRetenido} /></td>
                            <td className="px-3 py-2 text-right"><Money value={selected.saldoActual} /></td>
                            <td className="px-3 py-2 text-right"><Money value={selected.totalDevuelto} /></td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(estadoConfirm)}
        title="Cambiar estado del embargo"
        description={
          estadoConfirm ? (
            <>
              Vas a cambiar el embargo a <strong>{ESTADOS_EMBARGO.find((item) => item.value === estadoConfirm.estado)?.label}</strong>.
              {estadoConfirm.estado === 'BAJA' && ' El embargo quedará dado de baja y se registrará la fecha.'}
              {estadoConfirm.estado === 'CANCELADO' && ' Se considerará cancelado/finalizado.'}
              {estadoConfirm.estado === 'ACTIVO' && ' Volverá a estar vigente para imputar retenciones.'}
            </>
          ) : ''
        }
        confirmLabel="Cambiar estado"
        loading={actionLoading}
        onCancel={() => {
          setEstadoConfirm(null)
          setMotivoEstado('')
        }}
        onConfirm={() => void handleConfirmEstado()}
      >
        {estadoConfirm && (estadoConfirm.estado === 'BAJA' || estadoConfirm.estado === 'CANCELADO') && (
          <div className="mt-3">
            <TextField
              label="Motivo de la baja / cancelación"
              value={motivoEstado}
              onChange={setMotivoEstado}
              placeholder="Ej.: Renuncia, Decreto 1234/26, Deuda cancelada"
              maxLength={255}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {['Renuncia', 'Decreto', 'Deuda cancelada'].map((motivo) => (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => setMotivoEstado(motivo)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-[#1e3a8a] hover:bg-blue-50 hover:text-[#1e3a8a]"
                >
                  {motivo}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              El motivo se guarda con el embargo y alimenta la consulta “Bajas x Ren./Dec.”.
            </p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={embargoDelete !== null}
        title="Eliminar embargo"
        description="El embargo se quitará de la ficha y de las consultas. Las retenciones históricas quedarán asociadas al registro eliminado. Esta acción no se puede deshacer desde la pantalla."
        confirmLabel="Eliminar embargo"
        danger
        loading={actionLoading}
        onCancel={() => setEmbargoDelete(null)}
        onConfirm={() => void handleDeleteEmbargo()}
      />

      <ConfirmDialog
        open={retencionDelete !== null}
        title="Eliminar retención"
        description="Se eliminará la retención mensual y se recalcularán los saldos de todos los meses siguientes."
        confirmLabel="Eliminar retención"
        danger
        loading={actionLoading}
        onCancel={() => setRetencionDelete(null)}
        onConfirm={() => void handleDeleteRetencion()}
      />
    </div>
  )
}
