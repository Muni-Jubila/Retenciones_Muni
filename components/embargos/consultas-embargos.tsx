'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Filter, Loader2, RefreshCw, Search, Scale, SlidersHorizontal } from 'lucide-react'
import { consultarEmbargos } from '@/app/actions/embargos'
import {
  formatMoney,
  periodoLabel,
  resumenEstados,
  TIPOS_CONSULTA,
  type ConsultaEmbargosFiltros,
  type Embargo,
} from '@/lib/embargos'
import { Banner, EmptyState, EstadoBadge, Money, SelectField, TextField } from '@/components/embargos/ui'

interface ConsultasEmbargosProps {
  onOpenAgent: (agenteId: number) => void
}

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ESPERA', label: 'E · En espera' },
  { value: 'ACTIVO', label: 'A · Activo' },
  { value: 'BAJA', label: 'B · Baja' },
  { value: 'CANCELADO', label: 'C · Cancelado' },
]

export default function ConsultasEmbargos({ onOpenAgent }: ConsultasEmbargosProps) {
  const [tipo, setTipo] = useState<NonNullable<ConsultaEmbargosFiltros['tipo']>>('TODAS')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [resultados, setResultados] = useState<Embargo[]>([])
  const [loading, setLoading] = useState(false)
  const [consultado, setConsultado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tipoConfig = TIPOS_CONSULTA.find((item) => item.value === tipo) ?? TIPOS_CONSULTA[0]
  const resumen = resumenEstados(resultados)

  const ejecutar = async (overrides?: Partial<ConsultaEmbargosFiltros>) => {
    const filtros: ConsultaEmbargosFiltros = {
      tipo,
      texto,
      estado,
      periodo,
      ...overrides,
    }
    setLoading(true)
    setError(null)
    try {
      const filas = await consultarEmbargos(filtros)
      setResultados(filas)
      setConsultado(true)
    } catch {
      setError('No se pudo ejecutar la consulta. Verifique la conexión con la base de datos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void ejecutar({ tipo: 'TODAS', texto: '', estado: '', periodo: '' })
    // La consulta inicial se ejecuta una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const seleccionarTipo = (value: NonNullable<ConsultaEmbargosFiltros['tipo']>) => {
    setTipo(value)
    setTexto('')
    void ejecutar({ tipo: value, texto: '', estado, periodo })
  }

  const limpiar = () => {
    setTipo('TODAS')
    setTexto('')
    setEstado('')
    setPeriodo('')
    void ejecutar({ tipo: 'TODAS', texto: '', estado: '', periodo: '' })
  }

  return (
    <div className="space-y-4">
      {/* Tipos de consulta, espejo del menú legacy */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Filter className="h-4 w-4 text-[#1e3a8a]" />
              Consultas de embargos
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{tipoConfig.ayuda}</p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            {tipoConfig.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TIPOS_CONSULTA.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => seleccionarTipo(item.value)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                tipo === item.value
                  ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-[#1e3a8a]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <TextField
            label={tipoConfig.inputLabel ?? 'Texto libre'}
            value={texto}
            onChange={setTexto}
            placeholder={tipoConfig.inputLabel ? `Ingrese ${tipoConfig.inputLabel.toLowerCase()}...` : 'Expediente, autos, DNI o apellido'}
          />
          <SelectField label="Estado" value={estado} onChange={setEstado} options={ESTADO_OPTIONS} />
          <TextField label="Período" value={periodo} onChange={setPeriodo} type="month" />
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => void ejecutar()}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Consultar
            </button>
            <button
              type="button"
              onClick={limpiar}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
              title="Limpiar filtros"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Resultados', value: String(resumen.total) },
          { label: 'Deuda total', value: formatMoney(resumen.deuda) },
          { label: 'Retenido', value: formatMoney(resumen.retenido) },
          { label: 'Saldo pendiente', value: formatMoney(resumen.saldo) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
            <p className="mt-0.5 truncate font-mono text-sm font-bold text-slate-800" title={item.value}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Resultados */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1e3a8a]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Resultados de la consulta
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600">{resultados.length}</span>
          </h3>
          <span className="text-[10px] text-slate-400">Máximo 300 registros. Abrí la ficha para modificar.</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-[#1e3a8a]" />
            Consultando embargos...
          </div>
        ) : resultados.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Scale className="h-6 w-6" />}
              title={consultado ? 'Sin resultados para esta consulta' : 'Ejecutá una consulta'}
              description={
                consultado
                  ? 'Probá cambiar el tipo de consulta, el estado o el período. También podés buscar por expediente o agente.'
                  : 'Elegí un tipo de consulta y presioná “Consultar” para ver los embargos.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-xs">
              <thead className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-9 px-2 py-2 text-center">M</th>
                  <th className="px-3 py-2 text-left">DNI</th>
                  <th className="px-3 py-2 text-left">Agente</th>
                  <th className="px-3 py-2 text-left">Autos</th>
                  <th className="px-3 py-2 text-left">Expediente</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right">Deuda</th>
                  <th className="px-3 py-2 text-right">Retenido</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-left">
                    {tipo === 'PRIMER_MES' ? 'Primer mes' : 'Último mes'}
                  </th>
                  <th className="px-3 py-2 text-center print:hidden">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultados.map((embargo) => (
                  <tr key={embargo.id} className="transition hover:bg-slate-50">
                    <td className="px-2 py-2 text-center">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-black text-slate-600">
                        {embargo.estado === 'ACTIVO' ? 'A' : embargo.estado === 'ESPERA' ? 'E' : embargo.estado === 'BAJA' ? 'B' : 'C'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{embargo.dni || '—'}</td>
                    <td className="max-w-[190px] truncate px-3 py-2 font-semibold text-slate-800" title={embargo.agente}>{embargo.agente}</td>
                    <td className="max-w-[230px] truncate px-3 py-2 text-slate-600" title={embargo.autos}>{embargo.autos || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{embargo.expediente || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{embargo.fechaExpediente || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2"><EstadoBadge estado={embargo.estado} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right"><Money value={embargo.deuda} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-700"><Money value={embargo.totalRetenido} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-rose-600"><Money value={embargo.saldoActual} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {tipo === 'PRIMER_MES' ? periodoLabel(embargo.primerPeriodo) : periodoLabel(embargo.ultimoPeriodo)}
                    </td>
                    <td className="px-3 py-2 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => onOpenAgent(embargo.idAgente)}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#1e3a8a] transition hover:bg-blue-100"
                        title="Abrir la ficha del agente"
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
        )}
      </div>
    </div>
  )
}
