'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Ban,
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
  parseExpedienteRetenciones,
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
import ImportarOficio, { type ArchivoOficio } from '@/components/embargos/importar-oficio'
import ConsultaEmbargo from '@/components/embargos/consulta-embargo'
import type { DatosOficio } from '@/lib/oficio-parser'

interface FichaAgenteProps {
  initialAgenteId?: number | null
  initialEmbargoId?: number | null
  onInitialConsumed?: () => void
}

type Modo = 'ver' | 'nuevo' | 'editar'

interface OficioImportado {
  datos: DatosOficio
  archivo: ArchivoOficio
}

interface RetencionFormInput {
  periodo: string
  retencionSueldo: string
  retencionRefrigerio: string
  devolucion: string
  observaciones: string
}

/** Convierte los datos detectados en el PDF a valores del formulario de embargo. */
function oficioToPrefill(datos: DatosOficio): Partial<EmbargoInput> {
  const prefill: Partial<EmbargoInput> = {}
  if (datos.autos) prefill.autos = datos.autos
  if (datos.expediente) prefill.expediente = datos.expediente
  if (datos.fechaExpediente) prefill.fechaExpediente = datos.fechaExpediente
  if (datos.cuenta) {
    // La Cuenta N° se guarda sólo con dígitos y hasta 8 posiciones.
    const cuenta = datos.cuenta.replace(/\D/g, '')
    if (cuenta && cuenta.length <= 8) prefill.cuenta = cuenta
  }
  if (datos.sucursal) prefill.sucursal = datos.sucursal
  if (datos.juez) prefill.juez = datos.juez
  // El campo “Juez” del formulario guarda el nombre del juez detectado en el
  // cierre del oficio. Si no aparece, queda vacío para completarlo manualmente.
  prefill.secretaria = datos.juezNombre
  if (datos.monto > 0) prefill.deuda = moneyToInput(datos.monto)
  if (datos.numeroOficio) prefill.observaciones = `Oficio judicial N° ${datos.numeroOficio}.`
  return prefill
}

function DetailItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-xs font-medium text-slate-700">{value || '—'}</p>
    </div>
  )
}

function RetencionForm({
  initial,
  deuda,
  retenciones,
  periodosOcupados = [],
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  initial?: RetencionEmbargo | null
  deuda: number
  retenciones: RetencionEmbargo[]
  periodosOcupados?: string[]
  saving: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (input: RetencionFormInput) => void
}) {
  const calcularSaldo = (periodoConsulta: string) =>
    roundMoney(
      retenciones
        .filter((retencion) => retencion.periodo < periodoConsulta && retencion.id !== initial?.id)
        .reduce(
          (acc, retencion) => acc - retencion.retencionMensual + retencion.devolucion,
          deuda,
        ),
    )

  const normalizarRetenciones = (sueldo: number, refrigerio: number, saldo: number) => {
    let sueldoNormalizado = roundMoney(Math.max(sueldo, 0))
    let refrigerioNormalizado = roundMoney(Math.max(refrigerio, 0))
    const total = roundMoney(sueldoNormalizado + refrigerioNormalizado)
    if (total > saldo) {
      const excedente = roundMoney(total - saldo)
      if (sueldoNormalizado >= excedente) {
        sueldoNormalizado = roundMoney(sueldoNormalizado - excedente)
      } else {
        const resto = roundMoney(excedente - sueldoNormalizado)
        sueldoNormalizado = 0
        refrigerioNormalizado = roundMoney(Math.max(refrigerioNormalizado - resto, 0))
      }
    }
    return { sueldo: sueldoNormalizado, refrigerio: refrigerioNormalizado }
  }

  const periodoInicial = initial?.periodo ?? periodoActual()
  const saldoInicial = Math.max(calcularSaldo(periodoInicial), 0)

  // En registros viejos el total puede estar sólo en retencionMensual.
  const sueldoGuardado = initial
    ? initial.retencionSueldo > 0 || initial.retencionRefrigerio > 0
      ? initial.retencionSueldo
      : initial.retencionMensual
    : 0
  const refrigerioGuardado = initial?.retencionRefrigerio ?? 0

  // Si el registro guardado ya supera el saldo, se ajusta primero el sueldo.
  const inicial = normalizarRetenciones(sueldoGuardado, refrigerioGuardado, saldoInicial)

  const [periodo, setPeriodo] = useState(periodoInicial)
  const [retencionSueldo, setRetencionSueldo] = useState(
    initial ? moneyToInput(inicial.sueldo) : '',
  )
  const [retencionRefrigerio, setRetencionRefrigerio] = useState(
    initial ? moneyToInput(inicial.refrigerio) : '',
  )
  const [ajustada, setAjustada] = useState(
    Boolean(initial && (inicial.sueldo !== sueldoGuardado || inicial.refrigerio !== refrigerioGuardado)),
  )
  const [errores, setErrores] = useState<Record<string, string>>({})

  const saldoDisponible = Math.max(calcularSaldo(periodo), 0)
  const sueldoNum = parseMoneyInput(retencionSueldo)
  const refrigerioNum = parseMoneyInput(retencionRefrigerio)
  const totalRetencion = roundMoney(sueldoNum + refrigerioNum)
  const devolucionActual = initial?.devolucion ?? 0
  const saldoResultante = roundMoney(Math.max(saldoDisponible - totalRetencion + devolucionActual, 0))
  const periodoDuplicado = periodosOcupados.includes(periodo.trim())

  const limpiarError = (campo: string) => {
    setErrores((prev) => {
      if (!prev[campo]) return prev
      const next = { ...prev }
      delete next[campo]
      return next
    })
  }

  const handlePeriodoChange = (valor: string) => {
    setPeriodo(valor)
    limpiarError('periodo')
    const nuevoSaldo = Math.max(calcularSaldo(valor), 0)
    if (totalRetencion > nuevoSaldo) {
      const ajustado = normalizarRetenciones(sueldoNum, refrigerioNum, nuevoSaldo)
      setRetencionSueldo(moneyToInput(ajustado.sueldo))
      setRetencionRefrigerio(moneyToInput(ajustado.refrigerio))
      setAjustada(true)
    }
  }

  const handleSueldoChange = (valor: string) => {
    const maximo = Math.max(saldoDisponible - refrigerioNum, 0)
    const numero = parseMoneyInput(valor)
    if (numero > maximo) {
      setRetencionSueldo(moneyToInput(maximo))
      setAjustada(true)
    } else {
      setRetencionSueldo(valor)
      setAjustada(false)
    }
    limpiarError('retencionSueldo')
    limpiarError('retencionRefrigerio')
  }

  const handleRefrigerioChange = (valor: string) => {
    const maximo = Math.max(saldoDisponible - sueldoNum, 0)
    const numero = parseMoneyInput(valor)
    if (numero > maximo) {
      setRetencionRefrigerio(moneyToInput(maximo))
      setAjustada(true)
    } else {
      setRetencionRefrigerio(valor)
      setAjustada(false)
    }
    limpiarError('retencionSueldo')
    limpiarError('retencionRefrigerio')
  }

  const handleGuardar = () => {
    const next: Record<string, string> = {}
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo.trim())) {
      next.periodo = 'Seleccioná un período válido.'
    } else if (periodoDuplicado) {
      next.periodo = 'Ya existe una retención para ese período.'
    }
    if (saldoDisponible <= 0) {
      next.retencionSueldo = 'El embargo no tiene saldo pendiente para retener.'
    } else if (totalRetencion <= 0) {
      next.retencionSueldo = 'Ingresá la retención de sueldo o de refrigerio.'
      next.retencionRefrigerio = 'Ingresá la retención de sueldo o de refrigerio.'
    }
    setErrores(next)
    if (Object.keys(next).length > 0) return

    onSubmit({
      periodo,
      retencionSueldo: moneyToInput(sueldoNum),
      retencionRefrigerio: moneyToInput(refrigerioNum),
      // Se conservan los valores que no se editan en esta pantalla.
      devolucion: initial ? String(initial.devolucion) : '0',
      observaciones: initial?.observaciones ?? '',
    })
  }

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

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Período"
          value={periodo}
          onChange={handlePeriodoChange}
          type="month"
          hint="Cualquier mes; no se puede repetir."
          error={errores.periodo ?? (periodoDuplicado ? 'Ya existe una retención para ese período.' : null)}
        />
        <MoneyField
          label="Retención Sueldo"
          value={retencionSueldo}
          onChange={handleSueldoChange}
          placeholder="0,00"
          hint="Solo números y coma decimal (máx. 2 centavos)."
          error={errores.retencionSueldo ?? null}
        />
        <MoneyField
          label="Retención Refrigerio"
          value={retencionRefrigerio}
          onChange={handleRefrigerioChange}
          placeholder="0,00"
          hint="Solo números y coma decimal (máx. 2 centavos)."
          error={errores.retencionRefrigerio ?? null}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Retención total
          </span>
          <div className="rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-right font-mono text-sm font-bold text-[#1e3a8a]">
            {formatMoney(totalRetencion)}
          </div>
          <span className="text-[10px] text-slate-400">Suma de sueldo + refrigerio.</span>
        </div>
      </div>

      {ajustada && (
        <p className="mt-2 text-[10px] font-semibold text-amber-700">
          El importe se ajustó al saldo pendiente: {formatMoney(saldoDisponible)}.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-slate-500">
            Saldo disponible: <span className="font-mono font-bold text-slate-700">{formatMoney(saldoDisponible)}</span>.
          </p>
          <div
            className={`rounded-md border px-2.5 py-1 text-right text-xs ${
              ajustada ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 mr-1.5">Saldo resultante:</span>
            <span className="font-mono font-bold">{formatMoney(saldoResultante)}</span>
          </div>
        </div>
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
            disabled={saving}
            onClick={handleGuardar}
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

function coincideBusquedaEmbargo(embargo: Embargo, texto: string): boolean {
  const limpio = texto.trim()
  if (!limpio) return false

  if (/^\d{3}\.\d{3}\/\d{2}$/.test(limpio)) {
    const municipal = parseExpedienteRetenciones(limpio)
    if (municipal == null) return false
    return Number(embargo.expedienteRetenciones.replace(/\D/g, '')) === municipal
  }

  const digits = limpio.replace(/\D/g, '')
  const expJudicial = embargo.expediente.replace(/\D/g, '')
  return digits.length > 0 && expJudicial.length > 0 && (expJudicial === digits || expJudicial.includes(digits))
}

export default function FichaAgente({ initialAgenteId, initialEmbargoId, onInitialConsumed }: FichaAgenteProps) {
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
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false)
  const [embargoDelete, setEmbargoDelete] = useState<number | null>(null)
  const [retencionDelete, setRetencionDelete] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [consultaOpen, setConsultaOpen] = useState(false)
  const [confirmEmbargo, setConfirmEmbargo] = useState<EmbargoInput | null>(null)
  const [confirmRetencion, setConfirmRetencion] = useState<RetencionFormInput | null>(null)
  const [successDialog, setSuccessDialog] = useState<{ title: string; message: string } | null>(null)

  // Importación de oficios judiciales en PDF.
  const [prefillOficio, setPrefillOficio] = useState<Partial<EmbargoInput> | null>(null)
  const [oficioAdjunto, setOficioAdjunto] = useState<ArchivoOficio | null>(null)
  const [oficioPendiente, setOficioPendiente] = useState<OficioImportado | null>(null)
  const [formRevision, setFormRevision] = useState(0)

  const selected = useMemo(
    () => embargos.find((item) => item.id === selectedId) ?? null,
    [embargos, selectedId],
  )
  const resumen = useMemo(() => resumenEstados(embargos), [embargos])

  const recargarEmbargos = async (idAgente: number, preferId?: number, textoBusqueda?: string) => {
    const lista = await listarEmbargosDeAgente(idAgente)
    setEmbargos(lista)
    const coincidencia = textoBusqueda
      ? lista.find((embargo) => coincideBusquedaEmbargo(embargo, textoBusqueda))?.id
      : undefined
    setSelectedId((prev) => {
      if (preferId && lista.some((item) => item.id === preferId)) return preferId
      if (coincidencia && lista.some((item) => item.id === coincidencia)) return coincidencia
      if (prev && lista.some((item) => item.id === prev)) return prev
      return lista[0]?.id ?? null
    })
  }

  const aplicarOficio = (oficio: OficioImportado) => {
    setPrefillOficio(oficioToPrefill(oficio.datos))
    setOficioAdjunto(oficio.archivo)
    setOficioPendiente(null)
    setModo('nuevo')
    setFormError(null)
    setFormField(null)
    setNotice(null)
    setFormRevision((value) => value + 1)
  }

  const cargarAgente = async (
    empleado: Empleado,
    oficio?: OficioImportado | null,
    opciones?: { embargoId?: number; textoBusqueda?: string },
  ) => {
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
      await recargarEmbargos(empleado.id, opciones?.embargoId, opciones?.textoBusqueda)
    } catch {
      setError('No se pudieron cargar los embargos del agente.')
    } finally {
      setLoadingAgent(false)
    }
    if (oficio) aplicarOficio(oficio)
  }

  useEffect(() => {
    if (!initialAgenteId) return
    let active = true
    setLoadingAgent(true)
    getEmpleadoPorId(initialAgenteId)
      .then((empleado) => {
        if (!active) return
        if (empleado) void cargarAgente(empleado, null, { embargoId: initialEmbargoId ?? undefined })
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
  }, [initialAgenteId, initialEmbargoId])

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

  const handleSearch = async (textoOverride?: string, oficioOverride?: OficioImportado | null) => {
    const texto = (textoOverride ?? query).trim()
    if (!texto) return
    const oficio = oficioOverride ?? oficioPendiente
    setSearching(true)
    setError(null)
    setSinResultados(false)
    setResultados([])
    try {
      const encontrados = await buscarEmpleados(texto)
      if (encontrados.length === 0) {
        setSinResultados(true)
      } else if (encontrados.length === 1) {
        await cargarAgente(encontrados[0], oficio, { textoBusqueda: texto })
      } else {
        setResultados(encontrados)
      }
    } catch {
      setError('Error al buscar el agente. Verifique la conexión con la base de datos.')
    } finally {
      setSearching(false)
    }
  }

  const handleImportarOficio = async (empleado: Empleado, datos: DatosOficio, archivo: ArchivoOficio) => {
    const oficio = { datos, archivo }
    if (agente?.id === empleado.id) {
      aplicarOficio(oficio)
      return
    }
    await cargarAgente(empleado, oficio)
  }

  const handleBuscarAgenteOficio = (datos: DatosOficio, archivo: ArchivoOficio, dni?: string) => {
    const oficio = { datos, archivo }
    setOficioPendiente(oficio)
    if (dni) {
      setQuery(dni)
      void handleSearch(dni, oficio)
    } else {
      setNotice('Buscá al agente manualmente. Al seleccionarlo se abrirá el embargo con los datos del oficio.')
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
      setPrefillOficio(null)
      setOficioAdjunto(null)
      setOficioPendiente(null)
      const mensaje = modo === 'editar' ? 'El embargo se modificó correctamente.' : 'El embargo se creó correctamente.'
      setNotice(mensaje)
      setSuccessDialog({
        title: modo === 'editar' ? 'Cambios guardados' : 'Embargo creado',
        message: mensaje,
      })
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
      const estadoLabel = ESTADOS_EMBARGO.find((item) => item.value === estadoConfirm.estado)?.label
      const mensaje = `Estado actualizado a ${estadoLabel}.`
      setNotice(mensaje)
      setSuccessDialog({ title: 'Estado actualizado', message: mensaje })
      if (agente) await recargarEmbargos(agente.id, estadoConfirm.id)
      setRefreshKey((key) => key + 1)
    } catch {
      setError('No se pudo cambiar el estado del embargo.')
    } finally {
      setActionLoading(false)
      setEstadoConfirm(null)
      setMotivoEstado('')
      setConfirmarCancelacion(false)
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
      setSuccessDialog({ title: 'Embargo eliminado', message: 'El embargo se eliminó correctamente.' })
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
    setPrefillOficio(null)
    setOficioAdjunto(null)
    setOficioPendiente(null)
    setModo('nuevo')
    setFormError(null)
    setFormField(null)
    setNotice(null)
    setFormRevision((value) => value + 1)
  }

  const openEditar = () => {
    if (!selected) return
    setPrefillOficio(null)
    setOficioAdjunto(null)
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

  const handleSaveRetencion = async (input: RetencionFormInput) => {
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
      const mensaje = retencionEdit ? 'La retención se modificó correctamente.' : 'La retención se registró correctamente.'
      setNotice(mensaje)
      setSuccessDialog({
        title: retencionEdit ? 'Cambios guardados' : 'Retención registrada',
        message: mensaje,
      })
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
      setSuccessDialog({ title: 'Retención eliminada', message: 'La retención se eliminó y los saldos se recalcularon.' })
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
                placeholder="DNI, apellido, nombre, Exp. Judicial o Exp. Municipal..."
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
          Buscá por DNI, apellido, nombre, N° de expediente judicial o expediente municipal con formato 000.000/00.
          Desde la ficha podés cargar el embargo y sus retenciones sin cambiar de pantalla.
        </p>
      </div>

      {/* Resultados de búsqueda: justo debajo del buscador, antes de la carga de PDF */}
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
                onClick={() => void cargarAgente(empleado, oficioPendiente, { textoBusqueda: query })}
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

      {/* Importación de oficios judiciales */}
      <ImportarOficio
        onImport={(empleado, datos, archivo) => void handleImportarOficio(empleado, datos, archivo)}
        onBuscarAgente={handleBuscarAgenteOficio}
        onQuitar={() => setOficioAdjunto(null)}
      />

      {sinResultados && (
        <Banner tone="warning" onClose={() => setSinResultados(false)}>
          No se encontró ningún agente con ese dato. Probá con el DNI completo o parte del apellido.
        </Banner>
      )}
      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}
      {loadingAgent && <LoadingLine text="Cargando agente y embargos..." />}

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
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-base font-bold leading-tight">{agente.nombreCompleto}</h2>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-100">
                      DNI {agente.dni || '—'}
                    </span>
                  </div>
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
                  onClick={() => setConsultaOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Consulta Embargo
                </button>
                <button
                  type="button"
                  onClick={openNuevo}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#172554]"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Nuevo embargo
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs md:grid-cols-4">
              <DetailItem label="CUIL" value={agente.cuil} />
              <DetailItem label="Repartición" value={agente.secretaria} />
              <DetailItem label="Programa" value={agente.programa} />
              <DetailItem label="Cargo" value={agente.cargo} />
            </div>
          </div>

          {/* Resumen de embargos */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Embargos', value: String(resumen.total), icon: Scale, tone: 'text-[#1e3a8a] bg-blue-50' },
              { label: 'Activos', value: String(resumen.activos), icon: BadgeCheck, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'En espera', value: String(resumen.espera), icon: CalendarClock, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Deuda total', value: formatMoney(resumen.deuda), icon: Wallet, tone: 'text-slate-700 bg-slate-100' },
              { label: 'Total retenido', value: formatMoney(resumen.retenido), icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
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
              key={modo === 'editar' ? `edit-${selected?.id}` : `nuevo-${formRevision}`}
              agente={agente}
              initial={modo === 'editar' ? selected : null}
              prefill={modo === 'nuevo' ? prefillOficio : null}
              oficioUrl={modo === 'nuevo' ? oficioAdjunto?.url ?? null : null}
              oficioNombre={modo === 'nuevo' ? oficioAdjunto?.nombre ?? null : null}
              saving={saving}
              error={formError}
              field={formField}
              onCancel={() => {
                setModo('ver')
                setPrefillOficio(null)
                setOficioAdjunto(null)
              }}
              onSubmit={(input) => setConfirmEmbargo(input)}
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
                <table className="w-full min-w-[980px] text-xs">
                  <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Autos</th>
                      <th className="px-3 py-2 text-left">Exp. Judicial</th>
                      <th className="px-3 py-2 text-left">Exp. Retenciones</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-right">Deuda</th>
                      <th className="px-3 py-2 text-right">Total retenido</th>
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
                          <td className="max-w-[260px] truncate px-3 py-2 font-semibold text-slate-800" title={embargo.autos}>
                            {embargo.autos || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{embargo.expediente || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-500">{embargo.expedienteRetenciones || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">{embargo.fechaExpediente || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={embargo.deuda} className="text-slate-700" /></td>
                          <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={embargo.totalRetenido} className="text-emerald-700" /></td>
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
                      {selected.autos || 'Sin autos'} · Exp. judicial {selected.expediente || 's/n'} · Exp. retenciones{' '}
                      {selected.expedienteRetenciones || 's/n'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                    {(selected.estado === 'ACTIVO' || selected.estado === 'ESPERA') && (
                      <button
                        type="button"
                        onClick={() => {
                          setMotivoEstado('')
                          setEstadoConfirm({ id: selected.id, estado: 'CANCELADO' })
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                        title="Cancelar el embargo"
                      >
                        <Ban className="h-3 w-3" />
                        Cancelar
                      </button>
                    )}
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
                  <DetailItem label="Expediente Judicial N°" value={<span className="font-mono">{selected.expediente}</span>} />
                  <DetailItem label="Expediente Retenciones N°" value={<span className="font-mono">{selected.expedienteRetenciones}</span>} />
                  <DetailItem label="Fecha expediente" value={selected.fechaExpediente} />
                  <DetailItem label="Cuenta N°" value={<span className="font-mono">{selected.cuenta}</span>} />
                  <DetailItem label="Sucursal" value={selected.sucursal} />
                  <DetailItem label="Juzgado" value={selected.juez} />
                  <DetailItem label="Juez" value={selected.secretaria} />
                  <DetailItem label="Fecha de alta" value={selected.fechaAlta} />
                  <DetailItem label="Fecha de baja" value={selected.fechaBaja} />
                  <DetailItem label="Motivo de baja" value={selected.motivoBaja} className="col-span-2" />

                  <div className="col-span-2 mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    {selected.estado === 'ACTIVO' ? (
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
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700">
                        Solo se pueden agregar retenciones al embargo activo.
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {showRetencionForm && (
                    <RetencionForm
                      key={retencionEdit ? `edit-${retencionEdit.id}` : `new-${selected.id}`}
                      initial={retencionEdit}
                      deuda={selected.deuda}
                      retenciones={retenciones}
                      periodosOcupados={retenciones
                        .filter((retencion) => retencion.id !== retencionEdit?.id)
                        .map((retencion) => retencion.periodo)}
                      saving={savingRetencion}
                      error={retencionError}
                      onCancel={() => {
                        setShowRetencionForm(false)
                        setRetencionEdit(null)
                        setRetencionError(null)
                      }}
                      onSubmit={(input) => setConfirmRetencion(input)}
                    />
                  )}

                  {loadingRetenciones ? (
                    <LoadingLine text="Cargando retenciones..." />
                  ) : retenciones.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
                      <p className="text-xs font-semibold text-slate-600">Todavía no hay retenciones registradas.</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {selected.estado === 'ACTIVO'
                          ? 'Agregá el primer mes o usá “Actualizar → Imputar sueldo/refrigerio” para generarlas en lote.'
                          : 'Las retenciones se cargan únicamente cuando el embargo está activo.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="w-9 px-2 py-2 text-center">M</th>
                            <th className="px-3 py-2 text-left">Mes Ret.</th>
                            <th className="px-3 py-2 text-right">Retención Sueldo</th>
                            <th className="px-3 py-2 text-right">Retención Refrigerio</th>
                            <th className="px-3 py-2 text-right">Retención total</th>
                            <th className="px-3 py-2 text-right">Saldo</th>
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
                              <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={retencion.retencionSueldo} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={retencion.retencionRefrigerio} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-[#1e3a8a]"><Money value={retencion.retencionMensual > 0 ? retencion.retencionMensual : roundMoney(retencion.retencionSueldo + retencion.retencionRefrigerio)} /></td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-rose-600"><Money value={retencion.saldo} /></td>
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
                            <td colSpan={2} className="px-3 py-2 text-right uppercase tracking-wider">Totales</td>
                            <td className="px-3 py-2 text-right"><Money value={roundMoney(retenciones.reduce((acc, r) => acc + (r.retencionSueldo || 0), 0))} /></td>
                            <td className="px-3 py-2 text-right"><Money value={roundMoney(retenciones.reduce((acc, r) => acc + (r.retencionRefrigerio || 0), 0))} /></td>
                            <td className="px-3 py-2 text-right"><Money value={selected.totalRetenido} /></td>
                            <td className="px-3 py-2 text-right"><Money value={selected.saldoActual} /></td>
                            <td className="print:hidden" />
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
        open={Boolean(estadoConfirm) && !confirmarCancelacion}
        title="Cancelar embargo"
        description={
          estadoConfirm ? (
            <>
              Vas a cancelar el embargo <strong>{selected?.expediente || 'seleccionado'}</strong>. Si hay otro embargo
              del agente en espera, pasará automáticamente a <strong>activo</strong>.
            </>
          ) : ''
        }
        confirmLabel="Cancelar embargo"
        loading={actionLoading}
        onCancel={() => {
          setEstadoConfirm(null)
          setMotivoEstado('')
          setConfirmarCancelacion(false)
        }}
        onConfirm={() => setConfirmarCancelacion(true)}
      >
        {estadoConfirm && (
          <div className="mt-3">
            <TextField
              label="Motivo de la cancelación"
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
        open={Boolean(estadoConfirm) && confirmarCancelacion}
        title="Confirmar cancelación"
        description={
          estadoConfirm ? (
            <>
              ¿Deseás proseguir con la cancelación del embargo{' '}
              <strong>{selected?.expediente || 'seleccionado'}</strong>?
              {motivoEstado.trim() && (
                <>
                  <br />
                  Motivo: <strong>{motivoEstado.trim()}</strong>
                </>
              )}
            </>
          ) : ''
        }
        confirmLabel="Sí, cancelar embargo"
        danger
        loading={actionLoading}
        onCancel={() => setConfirmarCancelacion(false)}
        onConfirm={() => void handleConfirmEstado()}
      />

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

      <ConfirmDialog
        open={confirmEmbargo !== null}
        title={modo === 'editar' ? 'Guardar cambios del embargo' : 'Crear nuevo embargo'}
        description="¿Confirmás que querés guardar los datos cargados?"
        confirmLabel="Sí, guardar"
        loading={saving}
        onCancel={() => setConfirmEmbargo(null)}
        onConfirm={() => {
          const input = confirmEmbargo
          setConfirmEmbargo(null)
          if (input) void handleSaveEmbargo(input)
        }}
      />

      <ConfirmDialog
        open={confirmRetencion !== null}
        title={retencionEdit ? 'Guardar cambios de la retención' : 'Registrar retención'}
        description={
          confirmRetencion
            ? `Período ${periodoLabel(confirmRetencion.periodo)}. ¿Confirmás la operación?`
            : ''
        }
        confirmLabel="Sí, guardar"
        loading={savingRetencion}
        onCancel={() => setConfirmRetencion(null)}
        onConfirm={() => {
          const input = confirmRetencion
          setConfirmRetencion(null)
          if (input) void handleSaveRetencion(input)
        }}
      />

      <ConfirmDialog
        open={successDialog !== null}
        title={successDialog?.title ?? ''}
        description={successDialog?.message ?? ''}
        confirmLabel="Aceptar"
        hideCancel
        onCancel={() => setSuccessDialog(null)}
        onConfirm={() => setSuccessDialog(null)}
      />

      {agente && (
        <ConsultaEmbargo
          open={consultaOpen}
          agente={agente}
          embargos={embargos}
          selected={selected}
          onClose={() => setConsultaOpen(false)}
        />
      )}
    </div>
  )
}
