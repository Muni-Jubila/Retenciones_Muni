'use client'

import { useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Loader2,
  Scale,
  UserX,
} from 'lucide-react'
import {
  consultarAltas,
  listarActivosSinRetenciones,
  listarEmbargosNoImputacion,
} from '@/app/actions/embargos'
import { formatDate, getDateValidationError } from '@/lib/format-utils'
import { formatMoney, type ConsultaRangoFiltros, type Embargo } from '@/lib/embargos'
import { Banner, EmptyState, EstadoBadge, Money, TextField } from '@/components/embargos/ui'

interface ConsultasEmbargosProps {
  onOpenEmbargo: (agenteId: number, embargoId: number) => void
}

type OpcionId = 'NO_IMPUTACION' | 'ALTAS' | 'ACTIVOS'

interface OpcionConfig {
  id: OpcionId
  title: string
  description: string
  icon: React.ElementType
}

const OPCIONES: OpcionConfig[] = [
  {
    id: 'NO_IMPUTACION',
    title: 'Por No Imputación',
    description: 'Embargos cancelados con una cuota nueva pendiente de revisión.',
    icon: UserX,
  },
  {
    id: 'ALTAS',
    title: 'Consultas Altas',
    description: 'Embargos dados de alta en un rango de fechas y/o en un período.',
    icon: CalendarDays,
  },
  {
    id: 'ACTIVOS',
    title: 'Consultas Activos sin Retenciones',
    description: 'Embargos activos que todavía no tienen ninguna retención.',
    icon: Activity,
  },
]

const FILTROS_VACIOS: ConsultaRangoFiltros = {
  fechaDesde: '',
  fechaHasta: '',
  periodo: '',
}

function fechaComparable(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const fecha = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
  return Number.isNaN(fecha.getTime()) ? null : fecha.getTime()
}

function validarFiltros(
  filtros: ConsultaRangoFiltros,
  setErrores: React.Dispatch<React.SetStateAction<Record<string, string>>>,
): boolean {
  const errores: Record<string, string> = {}

  const errorDesde = getDateValidationError(filtros.fechaDesde, true)
  if (errorDesde) errores.fechaDesde = errorDesde

  const errorHasta = getDateValidationError(filtros.fechaHasta, true)
  if (errorHasta) errores.fechaHasta = errorHasta

  if (!errorDesde && !errorHasta && filtros.fechaDesde && filtros.fechaHasta) {
    const desde = fechaComparable(filtros.fechaDesde)
    const hasta = fechaComparable(filtros.fechaHasta)
    if (desde != null && hasta != null && desde > hasta) {
      errores.fechaHasta = 'La fecha hasta no puede ser anterior a la fecha desde.'
    }
  }

  setErrores(errores)
  return Object.keys(errores).length === 0
}

function GrillaEmbargos({
  filas,
  loading,
  consultado,
  mostrarEstado,
  onOpenEmbargo,
}: {
  filas: Embargo[]
  loading: boolean
  consultado: boolean
  mostrarEstado: boolean
  onOpenEmbargo: (agenteId: number, embargoId: number) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-8 text-xs font-semibold text-blue-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando embargos...
      </div>
    )
  }

  if (!consultado) {
    return (
      <EmptyState
        icon={<Scale className="h-6 w-6" />}
        title="Esperando consulta"
        description="La grilla se carga automáticamente al abrir la opción."
      />
    )
  }

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={<Scale className="h-6 w-6" />}
        title="Sin resultados"
        description="No hay embargos que coincidan con los filtros seleccionados."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">DNI</th>
            <th className="px-3 py-2 text-left">Nombre completo</th>
            <th className="px-3 py-2 text-left">Exp. Judicial</th>
            <th className="px-3 py-2 text-left">Exp. Retenciones</th>
            <th className="px-3 py-2 text-right">Deuda</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            {mostrarEstado && <th className="px-3 py-2 text-left">Estado</th>}
            <th className="px-3 py-2 text-center">Ficha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((embargo) => (
            <tr
              key={embargo.id}
              onClick={() => onOpenEmbargo(embargo.idAgente, embargo.id)}
              className="cursor-pointer transition hover:bg-blue-50/70"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{embargo.dni || '—'}</td>
              <td className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-800" title={embargo.agente}>
                {embargo.agente}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{embargo.expediente || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-500">
                {embargo.expedienteRetenciones || '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <Money value={embargo.deuda} className="text-slate-700" />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold">
                <Money
                  value={embargo.saldoActual}
                  className={embargo.saldoActual > 0 ? 'text-rose-600' : 'text-emerald-600'}
                />
              </td>
              {mostrarEstado && (
                <td className="whitespace-nowrap px-3 py-2">
                  <EstadoBadge estado={embargo.estado} compact />
                </td>
              )}
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenEmbargo(embargo.idAgente, embargo.id)
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#1e3a8a] transition hover:bg-blue-100"
                >
                  Abrir
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FiltrosRango({
  filtros,
  errores,
  loading,
  etiquetaBoton,
  onChange,
  onAplicar,
  onLimpiar,
}: {
  filtros: ConsultaRangoFiltros
  errores: Record<string, string>
  loading: boolean
  etiquetaBoton: string
  onChange: (campo: keyof ConsultaRangoFiltros, valor: string) => void
  onAplicar: () => void
  onLimpiar: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <TextField
        label="Fecha desde"
        value={filtros.fechaDesde ?? ''}
        onChange={(value) => onChange('fechaDesde', formatDate(value))}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        hint="Fecha de alta del embargo."
        error={errores.fechaDesde ?? null}
      />
      <TextField
        label="Fecha hasta"
        value={filtros.fechaHasta ?? ''}
        onChange={(value) => onChange('fechaHasta', formatDate(value))}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        hint="Fecha de alta del embargo."
        error={errores.fechaHasta ?? null}
      />
      <TextField
        label="Período"
        value={filtros.periodo ?? ''}
        onChange={(value) => onChange('periodo', value)}
        type="month"
        hint="Mes y año de alta."
      />
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onAplicar}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
          {etiquetaBoton}
        </button>
        <button
          type="button"
          onClick={onLimpiar}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
        >
          Limpiar
        </button>
      </div>
    </div>
  )
}

export default function ConsultasEmbargos({ onOpenEmbargo }: ConsultasEmbargosProps) {
  const [opcionAbierta, setOpcionAbierta] = useState<OpcionId | null>(null)
  const [resultados, setResultados] = useState<Record<OpcionId, Embargo[]>>({
    NO_IMPUTACION: [],
    ALTAS: [],
    ACTIVOS: [],
  })
  const [consultado, setConsultado] = useState<Record<OpcionId, boolean>>({
    NO_IMPUTACION: false,
    ALTAS: false,
    ACTIVOS: false,
  })
  const [cargando, setCargando] = useState<OpcionId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [filtrosAltas, setFiltrosAltas] = useState<ConsultaRangoFiltros>({ ...FILTROS_VACIOS })
  const [erroresAltas, setErroresAltas] = useState<Record<string, string>>({})
  const [filtrosActivos, setFiltrosActivos] = useState<ConsultaRangoFiltros>({ ...FILTROS_VACIOS })
  const [erroresActivos, setErroresActivos] = useState<Record<string, string>>({})

  const cargar = async (opcion: OpcionId, filtros: ConsultaRangoFiltros) => {
    setCargando(opcion)
    setError(null)
    try {
      const filas =
        opcion === 'NO_IMPUTACION'
          ? await listarEmbargosNoImputacion()
          : opcion === 'ALTAS'
            ? await consultarAltas(filtros)
            : await listarActivosSinRetenciones(filtros)

      setResultados((prev) => ({ ...prev, [opcion]: filas }))
      setConsultado((prev) => ({ ...prev, [opcion]: true }))
    } catch {
      setError('No se pudo cargar la consulta. Verificá la conexión con la base de datos.')
    } finally {
      setCargando(null)
    }
  }

  const toggleOpcion = (opcion: OpcionId) => {
    if (opcionAbierta === opcion) {
      setOpcionAbierta(null)
      return
    }

    setOpcionAbierta(opcion)
    setError(null)
    if (!consultado[opcion]) {
      const filtros = opcion === 'ALTAS' ? filtrosAltas : opcion === 'ACTIVOS' ? filtrosActivos : {}
      void cargar(opcion, filtros)
    }
  }

  const actualizarFiltro = (
    opcion: 'ALTAS' | 'ACTIVOS',
    campo: keyof ConsultaRangoFiltros,
    valor: string,
  ) => {
    if (opcion === 'ALTAS') {
      setFiltrosAltas((prev) => ({ ...prev, [campo]: valor }))
      setErroresAltas((prev) => {
        if (!prev[campo]) return prev
        const next = { ...prev }
        delete next[campo]
        return next
      })
    } else {
      setFiltrosActivos((prev) => ({ ...prev, [campo]: valor }))
      setErroresActivos((prev) => {
        if (!prev[campo]) return prev
        const next = { ...prev }
        delete next[campo]
        return next
      })
    }
  }

  const aplicarFiltros = (opcion: 'ALTAS' | 'ACTIVOS') => {
    const filtros = opcion === 'ALTAS' ? filtrosAltas : filtrosActivos
    const setErrores = opcion === 'ALTAS' ? setErroresAltas : setErroresActivos
    if (!validarFiltros(filtros, setErrores)) return
    void cargar(opcion, filtros)
  }

  const limpiarFiltros = (opcion: 'ALTAS' | 'ACTIVOS') => {
    if (opcion === 'ALTAS') {
      setFiltrosAltas({ ...FILTROS_VACIOS })
      setErroresAltas({})
    } else {
      setFiltrosActivos({ ...FILTROS_VACIOS })
      setErroresActivos({})
    }
    void cargar(opcion, { ...FILTROS_VACIOS })
  }

  const opcionActual = OPCIONES.find((opcion) => opcion.id === opcionAbierta) ?? null
  const filasActuales = opcionAbierta ? resultados[opcionAbierta] : []

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <FileSearch className="h-4 w-4 text-[#1e3a8a]" />
            Consultas de embargos
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Elegí una opción para desplegar los filtros y la grilla correspondiente.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {OPCIONES.map((opcion) => {
            const Icon = opcion.icon
            const activa = opcionAbierta === opcion.id
            return (
              <button
                key={opcion.id}
                type="button"
                onClick={() => toggleOpcion(opcion.id)}
                className={`flex min-h-[110px] w-full flex-col items-start gap-3 rounded-xl border p-4 text-left transition ${
                  activa
                    ? 'border-[#1e3a8a] bg-blue-50 ring-1 ring-[#1e3a8a]/20'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                }`}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                      activa ? 'bg-[#1e3a8a] text-white' : 'bg-blue-50 text-[#1e3a8a]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {activa ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-[#1e3a8a]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800">{opcion.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{opcion.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {opcionAbierta && opcionActual && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1e3a8a]">
                <opcionActual.icon className="h-3.5 w-3.5" />
                {opcionActual.title}
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600">
                  {resultados[opcionAbierta].length}
                </span>
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500">{opcionActual.description}</p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {opcionAbierta !== 'NO_IMPUTACION' && (
              <FiltrosRango
                filtros={opcionAbierta === 'ALTAS' ? filtrosAltas : filtrosActivos}
                errores={opcionAbierta === 'ALTAS' ? erroresAltas : erroresActivos}
                loading={cargando === opcionAbierta}
                etiquetaBoton={opcionAbierta === 'ALTAS' ? 'Consultar' : 'Filtrar'}
                onChange={(campo, valor) =>
                  actualizarFiltro(opcionAbierta === 'ALTAS' ? 'ALTAS' : 'ACTIVOS', campo, valor)
                }
                onAplicar={() => aplicarFiltros(opcionAbierta === 'ALTAS' ? 'ALTAS' : 'ACTIVOS')}
                onLimpiar={() => limpiarFiltros(opcionAbierta === 'ALTAS' ? 'ALTAS' : 'ACTIVOS')}
              />
            )}

            {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}

            <GrillaEmbargos
              filas={filasActuales}
              loading={cargando === opcionAbierta}
              consultado={consultado[opcionAbierta]}
              mostrarEstado={opcionAbierta === 'NO_IMPUTACION'}
              onOpenEmbargo={onOpenEmbargo}
            />
          </div>
        </div>
      )}
    </div>
  )
}
