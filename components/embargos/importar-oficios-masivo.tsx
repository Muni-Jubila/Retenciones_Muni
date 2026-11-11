'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FileText,
  FileUp,
  Loader2,
  Pencil,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { analizarOficioJudicial, type EmbargoExistenteOficio } from '@/app/actions/oficios'
import { crearEmbargo, listarEmbargosDeAgente } from '@/app/actions/embargos'
import { buscarEmpleados } from '@/app/actions/empleados'
import { formatMoney, getEstadoConfig, moneyToInput, parseMoneyInput } from '@/lib/embargos'
import { oficioToEmbargoInput } from '@/lib/oficio-embargo'
import type { DatosOficio } from '@/lib/oficio-parser'
import type { Empleado } from '@/lib/empleados'
import { Banner, ConfirmDialog, MoneyField, TextField } from '@/components/embargos/ui'

const MAX_FILE_BYTES = 6 * 1024 * 1024

type EstadoOficio = 'analizando' | 'listo' | 'creando' | 'creado' | 'error'

type EstadoVisual =
  | 'analizando'
  | 'incompleto'
  | 'duplicado'
  | 'pendiente'
  | 'revisado'
  | 'creando'
  | 'creado'
  | 'error'

interface OficioItem {
  id: string
  file: File
  nombre: string
  tamano: number
  url: string
  estado: EstadoOficio
  datos?: DatosOficio
  agente?: Empleado | null
  embargosExistentes: EmbargoExistenteOficio[]
  montoInput: string
  advertencias: string[]
  revisado: boolean
  error?: string
  agenteError?: string
  embargoCreado?: {
    id: number
    expediente: string
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

function camposFaltantes(datos?: DatosOficio, agente?: Empleado | null): string[] {
  if (!datos) return ['Datos del oficio']
  const faltantes: string[] = []
  if (!agente) faltantes.push('Agente')
  if (!datos.expediente && !datos.autos) faltantes.push('Expediente o autos')
  if (!(datos.monto > 0)) faltantes.push('Monto')
  return faltantes
}

function normalizarExpediente(value: string): string {
  return String(value ?? '').trim().toLowerCase().replace(/^0+/, '')
}

function embargoDuplicado(item: OficioItem): EmbargoExistenteOficio | null {
  if (!item.datos?.expediente) return null
  const expediente = normalizarExpediente(item.datos.expediente)
  if (!expediente) return null
  return (
    item.embargosExistentes.find(
      (embargo) => normalizarExpediente(embargo.expediente) === expediente,
    ) ?? null
  )
}

function estadoVisual(item: OficioItem): EstadoVisual {
  if (item.estado === 'analizando') return 'analizando'
  if (item.estado === 'error') return 'error'
  if (item.estado === 'creando') return 'creando'
  if (item.estado === 'creado') return 'creado'
  if (embargoDuplicado(item)) return 'duplicado'
  if (camposFaltantes(item.datos, item.agente).length > 0) return 'incompleto'
  return item.revisado ? 'revisado' : 'pendiente'
}

function etiquetaEstado(estado: EstadoVisual): string {
  if (estado === 'analizando') return 'Analizando'
  if (estado === 'incompleto') return 'Incompleto'
  if (estado === 'duplicado') return 'Ya cargado'
  if (estado === 'pendiente') return 'Revisar'
  if (estado === 'revisado') return 'Correcto para subir'
  if (estado === 'creando') return 'Creando embargo'
  if (estado === 'creado') return 'Embargo creado'
  return 'Error'
}

function EstadoIcono({ estado }: { estado: EstadoVisual }) {
  if (estado === 'analizando' || estado === 'creando') {
    return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
  }
  if (estado === 'creado' || estado === 'revisado') {
    return <CheckCircle2 className="h-3 w-3 text-emerald-600" />
  }
  if (estado === 'incompleto' || estado === 'error') {
    return <AlertCircle className="h-3 w-3 text-rose-600" />
  }
  if (estado === 'duplicado') {
    return <AlertCircle className="h-3 w-3 text-slate-500" />
  }
  return <FileText className="h-3 w-3 text-amber-600" />
}

function tonoEstado(estado: EstadoVisual): string {
  if (estado === 'analizando' || estado === 'creando') return 'border-blue-300 bg-blue-50 text-blue-700'
  if (estado === 'creado' || estado === 'revisado') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  if (estado === 'incompleto' || estado === 'error') return 'border-rose-300 bg-rose-50 text-rose-700'
  if (estado === 'duplicado') return 'border-slate-300 bg-slate-100 text-slate-600'
  return 'border-amber-300 bg-amber-50 text-amber-700'
}

function badgeEstado(estado: EstadoVisual): string {
  if (estado === 'analizando' || estado === 'creando') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (estado === 'creado' || estado === 'revisado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (estado === 'incompleto' || estado === 'error') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (estado === 'duplicado') return 'border-slate-200 bg-slate-100 text-slate-600'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

interface ImportarOficiosMasivoProps {
  onOpenAgent?: (agenteId: number) => void
  onImported?: () => void
}

/** Carga masiva de oficios judiciales con una pestaña por cada PDF. */
export default function ImportarOficiosMasivo({ onOpenAgent, onImported }: ImportarOficiosMasivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef<Set<string>>(new Set())
  const [items, setItems] = useState<OficioItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [confirmarCaso, setConfirmarCaso] = useState<string | null>(null)
  const [confirmarTodos, setConfirmarTodos] = useState(false)
  const [creandoTodos, setCreandoTodos] = useState(false)
  const [progreso, setProgreso] = useState<{
    total: number
    hechos: number
    creados: number
    errores: number
  } | null>(null)
  const [buscandoAgente, setBuscandoAgente] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url)
      urlsRef.current.clear()
    }
  }, [])

  const actualizar = (id: string, patch: Partial<OficioItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const editarDatos = (
    id: string,
    patch: Partial<DatosOficio>,
    extra: Partial<OficioItem> = {},
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.datos) return item
        return {
          ...item,
          datos: { ...item.datos, ...patch },
          revisado: false,
          agenteError: undefined,
          error: undefined,
          ...extra,
        }
      }),
    )
  }

  const editarMonto = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.datos
          ? {
              ...item,
              montoInput: value,
              datos: { ...item.datos, monto: parseMoneyInput(value) },
              revisado: false,
              error: undefined,
            }
          : item,
      ),
    )
  }

  const editarDni = (item: OficioItem, value: string) => {
    const dni = value.replace(/\D/g, '').slice(0, 9)
    const coincide =
      Boolean(item.agente) && (item.agente?.dni ?? '').replace(/\D/g, '') === dni
    editarDatos(item.id, { dni }, {
      agente: coincide ? item.agente : null,
      embargosExistentes: coincide ? item.embargosExistentes : [],
    })
  }

  const buscarAgenteActivo = async (item: OficioItem) => {
    const dni = (item.datos?.dni ?? '').replace(/\D/g, '')
    if (!dni) {
      actualizar(item.id, { agenteError: 'Ingresá un DNI para buscar el agente.' })
      return
    }
    setBuscandoAgente(true)
    actualizar(item.id, { agenteError: undefined })
    try {
      const encontrados = await buscarEmpleados(dni)
      const exacto = encontrados.find((empleado) => (empleado.dni ?? '').replace(/\D/g, '') === dni) ?? null
      if (!exacto) {
        actualizar(item.id, {
          agente: null,
          embargosExistentes: [],
          agenteError: `No se encontró un agente con DNI ${dni}.`,
        })
        return
      }
      const embargos = await listarEmbargosDeAgente(exacto.id)
      actualizar(item.id, {
        agente: exacto,
        embargosExistentes: embargos.map((embargo) => ({
          id: embargo.id,
          expediente: embargo.expediente,
          estado: embargo.estado,
        })),
        agenteError: undefined,
        revisado: false,
        error: undefined,
      })
    } catch {
      actualizar(item.id, { agenteError: 'No se pudo buscar el agente. Verificá la conexión.' })
    } finally {
      setBuscandoAgente(false)
    }
  }

  const analizar = async (item: OficioItem) => {
    try {
      const dataUrl = await readFileAsDataUrl(item.file)
      const respuesta = await analizarOficioJudicial({
        nombreArchivo: item.nombre,
        contenidoBase64: dataUrl,
      })
      if (!respuesta.ok || !respuesta.datos) {
        actualizar(item.id, { estado: 'error', error: respuesta.error ?? 'No se pudo analizar el oficio.' })
        return
      }
      actualizar(item.id, {
        estado: 'listo',
        datos: respuesta.datos,
        agente: respuesta.agente ?? null,
        embargosExistentes: respuesta.embargosExistentes ?? [],
        montoInput: moneyToInput(respuesta.datos.monto),
        advertencias: respuesta.advertencias,
        revisado: false,
        agenteError: undefined,
        error: undefined,
      })
    } catch {
      actualizar(item.id, { estado: 'error', error: 'No se pudo leer o analizar el PDF.' })
    }
  }

  const analizarLote = async (lote: OficioItem[]) => {
    for (const item of lote) {
      await analizar(item)
    }
  }

  const agregarArchivos = (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setNotice(null)
    setProgreso(null)

    const nuevos: OficioItem[] = []
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!esPdf) {
        nuevos.push({
          id,
          file,
          nombre: file.name,
          tamano: file.size,
          url: '',
          estado: 'error',
          advertencias: [],
          embargosExistentes: [],
          montoInput: '',
          revisado: false,
          error: 'El archivo debe ser un PDF.',
        })
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        nuevos.push({
          id,
          file,
          nombre: file.name,
          tamano: file.size,
          url: '',
          estado: 'error',
          advertencias: [],
          embargosExistentes: [],
          montoInput: '',
          revisado: false,
          error: `El PDF supera el tamaño máximo de ${formatBytes(MAX_FILE_BYTES)}.`,
        })
        continue
      }

      const url = URL.createObjectURL(file)
      urlsRef.current.add(url)
      nuevos.push({
        id,
        file,
        nombre: file.name,
        tamano: file.size,
        url,
        estado: 'analizando',
        advertencias: [],
        embargosExistentes: [],
        montoInput: '',
        revisado: false,
      })
    }

    setItems((prev) => [...prev, ...nuevos])
    setActiveId((prev) => prev ?? nuevos[0]?.id ?? null)

    const validos = nuevos.filter((item) => item.estado === 'analizando')
    if (validos.length > 0) void analizarLote(validos)
  }

  const quitar = (id: string) => {
    const item = items.find((actual) => actual.id === id)
    if (item?.url) {
      URL.revokeObjectURL(item.url)
      urlsRef.current.delete(item.url)
    }
    const restantes = items.filter((actual) => actual.id !== id)
    setItems(restantes)
    if (activeId === id) setActiveId(restantes[0]?.id ?? null)
  }

  const limpiarTodo = () => {
    for (const item of items) {
      if (item.url) URL.revokeObjectURL(item.url)
      urlsRef.current.delete(item.url)
    }
    setItems([])
    setActiveId(null)
    setError(null)
    setNotice(null)
    setProgreso(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const activo = items.find((item) => item.id === activeId) ?? items[0] ?? null
  const indiceActivo = activo ? items.findIndex((item) => item.id === activo.id) : -1
  const duplicadoActivo = activo ? embargoDuplicado(activo) : null
  const formularioDeshabilitado = activo
    ? activo.estado === 'creado' || activo.estado === 'creando' || creandoTodos
    : false
  const revisadosListos = items.filter((item) => estadoVisual(item) === 'revisado')
  const creados = items.filter((item) => item.estado === 'creado').length
  const duplicados = items.filter((item) => estadoVisual(item) === 'duplicado').length
  const incompletos = items.filter((item) => {
    const estado = estadoVisual(item)
    return estado === 'incompleto' || estado === 'error'
  }).length
  const pendientes = items.filter((item) => estadoVisual(item) === 'pendiente').length
  const analizando = items.filter((item) => item.estado === 'analizando').length
  const progresoPorcentaje = progreso
    ? Math.min(100, Math.round((progreso.hechos / Math.max(progreso.total, 1)) * 100))
    : 0
  const progresoCompletado = progreso ? progreso.hechos >= progreso.total : false

  const crearCaso = async (item: OficioItem): Promise<boolean> => {
    if (!item.datos || !item.agente || !item.revisado || embargoDuplicado(item)) return false

    actualizar(item.id, { estado: 'creando', error: undefined })
    try {
      const input = oficioToEmbargoInput(item.datos, item.agente.id)
      const resultado = await crearEmbargo(input)
      if (!resultado.ok) {
        actualizar(item.id, {
          estado: 'listo',
          error: resultado.error ?? 'No se pudo crear el embargo.',
        })
        return false
      }
      actualizar(item.id, {
        estado: 'creado',
        error: undefined,
        embargoCreado: {
          id: resultado.embargo?.id ?? 0,
          expediente: resultado.embargo?.expediente || input.expediente,
        },
      })
      return true
    } catch {
      actualizar(item.id, { estado: 'listo', error: 'No se pudo crear el embargo.' })
      return false
    }
  }

  const confirmarCreacion = async () => {
    if (!confirmarCaso) return
    const item = items.find((actual) => actual.id === confirmarCaso)
    setConfirmarCaso(null)
    if (!item) return
    const ok = await crearCaso(item)
    if (ok) {
      setNotice(`Embargo creado para ${item.agente?.nombreCompleto ?? item.nombre}.`)
      onImported?.()
    }
  }

  const crearTodos = async () => {
    setConfirmarTodos(false)
    if (revisadosListos.length === 0) return
    const lote = [...revisadosListos]
    setCreandoTodos(true)
    setError(null)
    setNotice(null)
    setProgreso({ total: lote.length, hechos: 0, creados: 0, errores: 0 })
    let creadosOk = 0
    let conError = 0
    for (const item of lote) {
      const ok = await crearCaso(item)
      if (ok) creadosOk += 1
      else conError += 1
      setProgreso({
        total: lote.length,
        hechos: creadosOk + conError,
        creados: creadosOk,
        errores: conError,
      })
    }
    setCreandoTodos(false)
    setProgreso({
      total: lote.length,
      hechos: lote.length,
      creados: creadosOk,
      errores: conError,
    })
    if (creadosOk > 0) {
      setNotice(
        conError > 0
          ? `Carga masiva finalizada: ${creadosOk} de ${lote.length} embargos creados. Quedaron ${conError} con error.`
          : `Carga masiva finalizada: se cargaron los ${lote.length} embargos.`,
      )
      onImported?.()
    }
    if (conError > 0) {
      setError(`${conError} oficio(s) revisados no se pudieron cargar. Revisá el detalle de cada pestaña.`)
    }
  }

  const navegar = (delta: number) => {
    if (items.length === 0) return
    const actual = indiceActivo < 0 ? 0 : indiceActivo
    const siguiente = Math.min(Math.max(actual + delta, 0), items.length - 1)
    setActiveId(items[siguiente].id)
  }


  const cambiarRevisado = (item: OficioItem, revisado: boolean) => {
    if (revisado && (camposFaltantes(item.datos, item.agente).length > 0 || embargoDuplicado(item))) return
    actualizar(item.id, { revisado })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-[#1e3a8a]">
            <FileUp className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Carga masiva de oficios judiciales</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Subí varios PDF a la vez. Cada oficio queda en una pestaña con el PDF y los datos detectados. Revisá y
              corregí la información; marcá en verde los que estén correctos y crealos con el botón de crear todos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              agregarArchivos(Array.from(event.target.files ?? []))
              if (inputRef.current) inputRef.current.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#172554]"
          >
            <Upload className="h-3.5 w-3.5" />
            Seleccionar PDFs
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={limpiarTodo}
              disabled={creandoTodos}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
        {notice && <Banner tone="success" onClose={() => setNotice(null)}>{notice}</Banner>}

        {items.length === 0 ? (
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(event) => {
              event.preventDefault()
              setArrastrando(false)
              agregarArchivos(Array.from(event.dataTransfer.files ?? []))
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              arrastrando ? 'border-[#1e3a8a] bg-blue-50' : 'border-slate-300 bg-slate-50/60'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#1e3a8a]">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Arrastrá uno o varios oficios acá o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-bold text-[#1e3a8a] underline decoration-blue-300 underline-offset-2 hover:text-[#172554]"
              >
                seleccioná los archivos
              </button>
            </p>
            <p className="text-[10px] text-slate-400">
              PDF con texto seleccionable · máximo {formatBytes(MAX_FILE_BYTES)} por archivo
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                  {items.length} oficio(s)
                </span>
                {analizando > 0 && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                    {analizando} analizando
                  </span>
                )}
                {pendientes > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                    {pendientes} para revisar
                  </span>
                )}
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  {revisadosListos.length} en verde
                </span>
                {creados > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                    {creados} creado(s)
                  </span>
                )}
                {incompletos > 0 && (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                    {incompletos} en rojo
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmarTodos(true)}
                disabled={creandoTodos || revisadosListos.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {creandoTodos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
                {creandoTodos ? 'Creando...' : `Crear todos los listos (${revisadosListos.length})`}
              </button>
            </div>

            {progreso && (
              <div
                className={`rounded-xl border p-3 ${
                  progresoCompletado
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={`flex items-center gap-1.5 text-xs font-bold ${
                      progresoCompletado ? 'text-emerald-800' : 'text-blue-800'
                    }`}
                  >
                    {progresoCompletado ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    {progresoCompletado ? 'Carga masiva finalizada' : 'Creando embargos...'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold ${
                        progresoCompletado ? 'text-emerald-800' : 'text-blue-800'
                      }`}
                    >
                      {progreso.hechos} / {progreso.total}
                    </span>
                    {progresoCompletado && (
                      <button
                        type="button"
                        onClick={() => setProgreso(null)}
                        className="rounded p-0.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
                        title="Cerrar progreso"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      progresoCompletado ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${progresoPorcentaje}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-600">
                  {progreso.creados} creado(s) · {progreso.errores} con error
                  {progresoCompletado && progreso.errores === 0
                    ? ' · todos los embargos quedaron cargados correctamente.'
                    : ''}
                </p>
              </div>
            )}

            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => navegar(-1)}
                disabled={indiceActivo <= 0}
                className="flex flex-shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                title="Oficio anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex flex-1 gap-1 overflow-x-auto pb-1">
                {items.map((item, indice) => {
                  const visual = estadoVisual(item)
                  const activoItem = item.id === activo?.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={`flex min-w-[170px] max-w-[260px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${tonoEstado(visual)} ${
                        activoItem ? 'ring-2 ring-[#1e3a8a] ring-offset-1' : 'hover:brightness-[0.98]'
                      }`}
                      title={`${item.nombre} · ${etiquetaEstado(visual)}`}
                    >
                      <EstadoIcono estado={visual} />
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-bold">{item.nombre}</span>
                        <span className="block text-[9px] opacity-80">
                          {indice + 1} · {etiquetaEstado(visual)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => navegar(1)}
                disabled={indiceActivo < 0 || indiceActivo >= items.length - 1}
                className="flex flex-shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                title="Oficio siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {activo && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#1e3a8a]" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{activo.nombre}</p>
                      <p className="text-[9px] text-slate-400">
                        {formatBytes(activo.tamano)} · {etiquetaEstado(estadoVisual(activo))}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badgeEstado(
                        estadoVisual(activo),
                      )}`}
                    >
                      <EstadoIcono estado={estadoVisual(activo)} />
                      {etiquetaEstado(estadoVisual(activo))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activo.url && (
                      <a
                        href={activo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir PDF
                      </a>
                    )}
                    {activo.estado !== 'creado' && (
                      <button
                        type="button"
                        onClick={() => quitar(activo.id)}
                        disabled={activo.estado === 'creando' || creandoTodos}
                        className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        <X className="h-3 w-3" />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    {activo.url ? (
                      <iframe
                        src={activo.url}
                        title={`Vista previa de ${activo.nombre}`}
                        className="h-[420px] w-full rounded-lg border border-slate-200 bg-slate-100 lg:h-[560px]"
                      />
                    ) : (
                      <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 lg:h-[560px]">
                        Sin vista previa
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 lg:col-span-5">
                    {activo.estado === 'analizando' && (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs font-semibold text-blue-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Leyendo el oficio y buscando el agente...
                      </div>
                    )}

                    {activo.error && (
                      <Banner tone="error" onClose={() => actualizar(activo.id, { error: undefined })}>
                        {activo.error}
                      </Banner>
                    )}

                    {activo.embargoCreado && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                              Embargo creado
                            </p>
                            <p className="text-sm font-bold text-slate-800">
                              Exp. {activo.embargoCreado.expediente || 's/n'}
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Agente: {activo.agente?.nombreCompleto ?? '—'}
                            </p>
                          </div>
                        </div>
                        {onOpenAgent && activo.agente && (
                          <button
                            type="button"
                            onClick={() => onOpenAgent(activo.agente!.id)}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100"
                          >
                            Ver ficha del agente
                          </button>
                        )}
                      </div>
                    )}

                    {activo.datos && (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]">
                            <Pencil className="h-3 w-3" />
                            Datos del oficio (editables)
                          </p>
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <TextField
                              label="Expediente judicial"
                              value={activo.datos.expediente}
                              onChange={(value) => editarDatos(activo.id, { expediente: value })}
                              maxLength={100}
                              disabled={formularioDeshabilitado}
                            />
                            <TextField
                              label="Fecha expediente"
                              value={activo.datos.fechaExpediente}
                              onChange={(value) => editarDatos(activo.id, { fechaExpediente: value })}
                              placeholder="dd/mm/aaaa"
                              maxLength={10}
                              disabled={formularioDeshabilitado}
                            />
                            <MoneyField
                              label="Monto del embargo"
                              value={activo.montoInput}
                              onChange={(value) => editarMonto(activo.id, value)}
                              disabled={formularioDeshabilitado}
                            />
                            <TextField
                              label="Cuenta N°"
                              value={activo.datos.cuenta}
                              onChange={(value) =>
                                editarDatos(activo.id, { cuenta: value.replace(/\D/g, '').slice(0, 8) })
                              }
                              maxLength={8}
                              hint="Hasta 8 dígitos."
                              disabled={formularioDeshabilitado}
                            />
                            <TextField
                              label="Sucursal"
                              value={activo.datos.sucursal}
                              onChange={(value) => editarDatos(activo.id, { sucursal: value })}
                              maxLength={50}
                              disabled={formularioDeshabilitado}
                            />
                            <TextField
                              label="Juzgado"
                              value={activo.datos.juez}
                              onChange={(value) => editarDatos(activo.id, { juez: value })}
                              maxLength={255}
                              disabled={formularioDeshabilitado}
                            />
                            <TextField
                              label="Juez"
                              value={activo.datos.juezNombre}
                              onChange={(value) => editarDatos(activo.id, { juezNombre: value })}
                              maxLength={100}
                              disabled={formularioDeshabilitado}
                            />
                            <TextField
                              label="DNI del agente"
                              value={activo.datos.dni}
                              onChange={(value) => editarDni(activo, value)}
                              maxLength={9}
                              disabled={formularioDeshabilitado}
                            />
                            <div className="sm:col-span-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                  Autos
                                </span>
                                <textarea
                                  value={activo.datos.autos}
                                  onChange={(event) => editarDatos(activo.id, { autos: event.target.value })}
                                  maxLength={500}
                                  rows={3}
                                  disabled={formularioDeshabilitado}
                                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void buscarAgenteActivo(activo)}
                              disabled={buscandoAgente || formularioDeshabilitado}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                            >
                              {buscandoAgente ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Search className="h-3 w-3" />
                              )}
                              Buscar agente por DNI
                            </button>
                            <span
                              className={`text-[10px] font-semibold ${
                                activo.agente ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {activo.agente
                                ? `Agente: ${activo.agente.nombreCompleto}`
                                : 'Sin agente asociado'}
                            </span>
                          </div>
                          {activo.agenteError && (
                            <p className="mt-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">
                              {activo.agenteError}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">
                            Los cambios se guardan automáticamente para la revisión.
                          </p>
                        </div>

                        {activo.agente ? (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                  Agente encontrado
                                </p>
                                <p className="truncate text-sm font-bold text-slate-800">
                                  {activo.agente.nombreCompleto}
                                </p>
                                <p className="text-[10px] text-slate-600">
                                  DNI {activo.agente.dni || '—'} · CUIL {activo.agente.cuil || '—'}
                                </p>
                                <p className="truncate text-[10px] text-slate-500">
                                  {activo.agente.programa || 'Sin programa'} · {activo.agente.cargo || 'Sin cargo'} ·{' '}
                                  {activo.agente.estadoActivo ? 'Activo' : 'Inactivo'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
                                  {activo.datos.dni ? 'Agente no encontrado' : 'DNI no detectado'}
                                </p>
                                <p className="text-[11px] leading-relaxed text-rose-800">
                                  {activo.datos.dni
                                    ? `No hay un agente con DNI ${activo.datos.dni}. Editá el DNI y buscá el agente, o quitá la pestaña si el PDF es un informe.`
                                    : 'No se pudo leer el DNI. Editá los datos y buscá el agente, o quitá la pestaña si el PDF es un informe.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {duplicadoActivo ? (
                          <div className="rounded-lg border border-slate-300 bg-slate-100 p-3">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                              <AlertCircle className="h-3 w-3" />
                              Ya existe un embargo con este expediente
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
                              El agente ya tiene cargado el expediente{' '}
                              <strong>{duplicadoActivo.expediente || 's/n'}</strong> en estado{' '}
                              <strong>{getEstadoConfig(duplicadoActivo.estado).label}</strong>. No se puede volver a
                              cargar. Si el PDF es un informe, quitá esta pestaña.
                            </p>
                            {onOpenAgent && activo.agente && (
                              <button
                                type="button"
                                onClick={() => onOpenAgent(activo.agente!.id)}
                                className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Abrir ficha del agente
                              </button>
                            )}
                          </div>
                        ) : camposFaltantes(activo.datos, activo.agente).length > 0 ? (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                              <AlertCircle className="h-3 w-3" />
                              Incompleto para crear el embargo
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-rose-800">
                              Faltan: {camposFaltantes(activo.datos, activo.agente).join(', ')}. Editá los datos para
                              completarlos. Si el PDF es un informe y no un embargo, quitá esta pestaña.
                            </p>
                          </div>
                        ) : activo.estado !== 'creado' ? (
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <input
                              type="checkbox"
                              checked={activo.revisado}
                              onChange={(event) => cambiarRevisado(activo, event.target.checked)}
                              disabled={creandoTodos || activo.estado === 'creando'}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>
                              <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                Datos correctos
                              </span>
                              <span className="block text-[11px] leading-relaxed text-emerald-800">
                                Marcá el check para habilitar la creación del embargo. Al quedar en verde se incluye en
                                “Crear todos los listos”.
                              </span>
                            </span>
                          </label>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          {activo.revisado &&
                            activo.agente &&
                            !duplicadoActivo &&
                            activo.estado !== 'creado' && (
                              <button
                                type="button"
                                onClick={() => setConfirmarCaso(activo.id)}
                                disabled={activo.estado === 'creando' || creandoTodos}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
                              >
                                {activo.estado === 'creando' ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FilePlus2 className="h-3.5 w-3.5" />
                                )}
                                {activo.estado === 'creando' ? 'Creando...' : 'Crear embargo'}
                              </button>
                            )}
                          {onOpenAgent && activo.agente && (
                            <button
                              type="button"
                              onClick={() => onOpenAgent(activo.agente!.id)}
                              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Abrir ficha
                            </button>
                          )}
                        </div>

                        {activo.advertencias.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              <AlertCircle className="h-3 w-3" />
                              Revisar antes de guardar
                            </p>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-amber-800">
                              {activo.advertencias.map((advertencia) => (
                                <li key={advertencia}>{advertencia}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmarCaso)}
        title="Crear embargo desde el oficio"
        description={
          confirmarCaso
            ? (() => {
                const item = items.find((actual) => actual.id === confirmarCaso)
                const datos = item?.datos
                const agente = item?.agente
                return (
                  <>
                    Se va a crear un embargo para <strong>{agente?.nombreCompleto ?? 'el agente'}</strong> con expediente{' '}
                    <strong>{datos?.expediente || 's/n'}</strong>
                    {datos?.monto ? (
                      <>
                        {' '}por <strong>{formatMoney(datos.monto)}</strong>
                      </>
                    ) : null}
                    . Podés revisar o corregir los datos después desde la ficha del agente.
                  </>
                )
              })()
            : ''
        }
        confirmLabel="Crear embargo"
        loading={Boolean(confirmarCaso && items.find((item) => item.id === confirmarCaso)?.estado === 'creando')}
        onCancel={() => setConfirmarCaso(null)}
        onConfirm={() => void confirmarCreacion()}
      />

      <ConfirmDialog
        open={confirmarTodos}
        title="Crear todos los embargos marcados en verde"
        description={
          <>
            Se van a crear <strong>{revisadosListos.length}</strong> embargo(s) de los oficios marcados como correctos.
            Los que tengan datos incompletos o expedientes duplicados quedarán con error en su pestaña.
          </>
        }
        confirmLabel="Crear todos"
        loading={creandoTodos}
        onCancel={() => setConfirmarTodos(false)}
        onConfirm={() => void crearTodos()}
      />
    </div>
  )
}
