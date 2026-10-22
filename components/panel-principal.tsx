'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pencil,
  Save,
  Scale,
  Search,
  UserCircle,
  Users,
  X,
} from 'lucide-react'
import { actualizarEmpleado, buscarEmpleados, getUltimoEmpleado } from '@/app/actions/empleados'
import { type Empleado } from '@/lib/empleados'
import { getDateValidationError } from '@/lib/format-utils'
import { FormField, SectionCard } from '@/components/form-field'

const EDIT_FIELDS: { key: keyof Empleado; label: string }[] = [
  { key: 'cuil', label: 'CUIL' },
  { key: 'dni', label: 'DNI' },
  { key: 'nombreCompleto', label: 'Apellido y Nombres' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo Electrónico' },
  { key: 'programa', label: 'Programa' },
  { key: 'secretaria', label: 'Secretaría' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'antiguedadRecibo', label: 'Antigüedad Actual' },
  { key: 'antiguedadLicencias', label: 'Antigüedad al 31/12' },
  { key: 'fechaNacimiento', label: 'Fecha de Nacimiento' },
  { key: 'edadActual', label: 'Edad Actual' },
]

function getDiffs(original: Empleado, current: Empleado) {
  return EDIT_FIELDS
    .filter((field) => (original[field.key] ?? '') !== (current[field.key] ?? ''))
    .map((field) => ({
      label: field.label,
      oldVal: original[field.key] || '—',
      newVal: current[field.key] || '—',
    }))
}

interface PanelPrincipalProps {
  onVerEmbargos?: (empleadoId: number) => void
}

export default function PanelPrincipal({ onVerEmbargos }: PanelPrincipalProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Empleado | null>(null)
  const [snapshot, setSnapshot] = useState<Empleado | null>(null)
  const [results, setResults] = useState<Empleado[]>([])
  const [showGrid, setShowGrid] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [notFoundPopup, setNotFoundPopup] = useState(false)
  const [showEditConfirmPopup, setShowEditConfirmPopup] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      setLoadingRecord(true)
      try {
        const last = await getUltimoEmpleado()
        if (!cancelled && last) setSelected(last)
      } catch {
        // No bloqueamos el panel si falla la carga inicial
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    loadInitial()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelect = (empleado: Empleado) => {
    setSelected(empleado)
    setShowGrid(false)
    setEditing(false)
    setSnapshot(null)
    setGlobalError(null)
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleSearchAndLoad = async () => {
    const query = search.trim()
    if (!query) return
    setLoadingSearch(true)
    setGlobalError(null)
    try {
      const encontrados = await buscarEmpleados(query)
      if (encontrados.length === 0) {
        setShowGrid(false)
        setNotFoundPopup(true)
      } else if (encontrados.length === 1) {
        setShowGrid(false)
        handleSelect(encontrados[0])
      } else {
        setResults(encontrados)
        setShowGrid(true)
      }
    } catch {
      setGlobalError('Error al buscar en la base de datos. Verifique la conexión.')
    } finally {
      setLoadingSearch(false)
    }
  }

  const update = (field: keyof Empleado, value: string) => {
    setSelected((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const startEdit = () => {
    if (!selected) return
    setSnapshot(selected)
    setEditing(true)
    setGlobalError(null)
  }

  const handleCancelEdit = () => {
    if (snapshot) setSelected(snapshot)
    setEditing(false)
    setGlobalError(null)
  }

  const handleSave = async () => {
    if (!selected) return

    const dateError = getDateValidationError(selected.fechaNacimiento, true)
    if (dateError) {
      setGlobalError(dateError)
      return
    }

    setSaving(true)
    setGlobalError(null)
    try {
      const result = await actualizarEmpleado(selected.id, {
        apellido: selected.apellido,
        segundoApellido: selected.segundoApellido,
        nombre: selected.nombre,
        segundoNombre: selected.segundoNombre,
        telefono: selected.telefono,
        correo: selected.correo,
        fechaNacimiento: selected.fechaNacimiento,
      })

      if (!result.ok || !result.empleado) {
        setGlobalError(result.error ?? 'No se pudieron guardar los cambios.')
        return
      }

      setSelected(result.empleado)
      setSnapshot(result.empleado)
      setEditing(false)
      setShowSuccessPopup(true)
    } catch {
      setGlobalError('Error al guardar en la base de datos. Verifique la conexión.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEdit = () => {
    if (!editing) {
      startEdit()
      return
    }

    const dateError = getDateValidationError(selected?.fechaNacimiento ?? '', true)
    if (dateError) {
      setGlobalError(dateError)
      return
    }

    setShowEditConfirmPopup(true)
  }

  const handleConfirmEdit = async () => {
    setShowEditConfirmPopup(false)
    await handleSave()
  }

  const isActivo = selected ? selected.estadoActivo : false

  return (
    <div>
      <div>
        {/* ── Sticky status bar ───────────────────────────────────────────── */}
        {selected && (
          <div
            className={`sticky top-0 z-20 border-b shadow-sm px-6 py-2.5 flex items-center gap-3 ${
              isActivo ? 'bg-emerald-600 border-emerald-700' : 'bg-red-600 border-red-700'
            }`}
          >
            <UserCircle className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">
              {selected.nombreCompleto || 'Nuevo Registro'}
            </span>
            <span className="text-xs font-mono text-white/80 flex-shrink-0">
              DNI: {selected.dni || '—'}
            </span>
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border flex-shrink-0 ${
                isActivo
                  ? 'bg-emerald-500/40 border-emerald-300 text-white'
                  : 'bg-red-500/40 border-red-300 text-white'
              }`}
            >
              {isActivo ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
        )}

        {/* ── Not-found popup ─────────────────────────────────────────────── */}
        {notFoundPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-7 max-w-sm w-full mx-4 flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 border border-amber-200">
                <Search className="w-6 h-6 text-amber-500" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800 mb-1">Sin resultados</h3>
                <p className="text-sm text-slate-500">
                  No se encontró ningún registro que coincida con la búsqueda.
                </p>
              </div>
              <button
                onClick={() => setNotFoundPopup(false)}
                className="px-5 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-semibold transition"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* ── Edit confirmation popup ─────────────────────────────────────── */}
        {showEditConfirmPopup && selected && snapshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-[#1e3a8a] text-white">
                <div>
                  <h3 className="text-base font-bold">Confirmación de Edición del Empleado</h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Se están por guardar las siguientes modificaciones en los datos de{' '}
                    <span className="font-semibold">{selected.nombreCompleto}</span>:
                  </p>
                </div>
                <button
                  onClick={() => setShowEditConfirmPopup(false)}
                  className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body: Diff List */}
              {(() => {
                const editDiffs = getDiffs(snapshot, selected)
                return (
                  <div className="overflow-y-auto p-6 space-y-4 text-xs">
                    {editDiffs.length === 0 ? (
                      <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs leading-relaxed">
                        No se detectaron modificaciones en los datos del empleado.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1">
                            DATOS PERSONALES
                          </h4>
                          <ul className="pl-2 space-y-2 text-slate-700 font-mono">
                            {editDiffs.map((diff, idx) => (
                              <li key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 text-xs">
                                <span className="font-semibold text-slate-900 min-w-[150px]">• {diff.label}:</span>
                                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200">
                                  <span className="line-through text-rose-500 font-medium">{diff.oldVal}</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-emerald-700 font-bold">{diff.newVal}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditConfirmPopup(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
                >
                  Rechazar / Cancelar
                </button>
                <button
                  onClick={() => void handleConfirmEdit()}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit success popup ──────────────────────────────────────────── */}
        {showSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-7 max-w-sm w-full mx-4 flex flex-col items-center gap-4 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">¡Edición Exitosa!</h3>
                <p className="text-sm text-slate-600">
                  Se guardaron con éxito los datos del empleado.
                </p>
              </div>
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full px-5 py-2.5 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-semibold transition shadow"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          <h1 className="text-xl font-bold text-[#1e3a8a] mb-5">Panel Principal</h1>

          {/* ── Error banner ──────────────────────────────────────────────── */}
          {globalError && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{globalError}</span>
              <button
                onClick={() => setGlobalError(null)}
                className="ml-auto text-red-400 hover:text-red-600 transition"
                aria-label="Cerrar error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Loading overlay (carga de registro individual) ────────────── */}
          {loadingRecord && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Cargando registro...</span>
            </div>
          )}

          {/* ── Saving overlay ────────────────────────────────────────────── */}
          {saving && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Guardando en la base de datos...</span>
            </div>
          )}

          {/* ── Search bar ────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Documento o Apellido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void handleSearchAndLoad()
                }}
                className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition"
              />
            </div>
            <button
              onClick={() => void handleSearchAndLoad()}
              disabled={loadingSearch}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
            >
              {loadingSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loadingSearch ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {/* ── Grilla de coincidencias ───────────────────────────────────── */}
          {showGrid && results.length > 1 && (
            <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">
                  {results.length} coincidencia{results.length !== 1 ? 's' : ''}
                </span>
                <span className="ml-auto">
                  <button
                    onClick={() => setShowGrid(false)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition"
                    title="Cerrar la lista de resultados"
                  >
                    <X className="w-3 h-3" />
                    Cerrar
                  </button>
                </span>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider w-28">DNI</th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Apellido y Nombres</th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Programa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((empleado) => {
                      const isSelected = selected?.id === empleado.id
                      return (
                        <tr
                          key={empleado.id}
                          onClick={() => handleSelect(empleado)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-blue-50 border-l-2 border-l-[#1e3a8a]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono text-slate-600">{empleado.dni || '—'}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">{empleado.nombreCompleto || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500 truncate max-w-[240px]">{empleado.programa || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Selected record detail ────────────────────────────────────── */}
          {selected && (
            <div ref={detailRef} className="flex flex-col gap-4">
              {/* Edit/Save header */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                  <UserCircle className="w-5 h-5 text-[#1e3a8a]" />
                  <h2 className="text-base font-bold text-slate-800">
                    EMPLEADO:{' '}
                    <span className="text-[#1e3a8a]">
                      {selected.nombreCompleto || 'Nuevo Registro'} &nbsp; {selected.dni}
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {onVerEmbargos && (
                    <button
                      onClick={() => onVerEmbargos(selected.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 transition"
                      title="Abrir la ficha de embargos de este agente"
                    >
                      <Scale className="w-4 h-4" />
                      <span>Embargos</span>
                    </button>
                  )}
                  {editing && (
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancelar</span>
                    </button>
                  )}
                  <button
                    onClick={handleToggleEdit}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      editing
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-[#1e3a8a] hover:bg-[#172554] text-white'
                    }`}
                  >
                    {editing ? (
                      <><Save className="w-4 h-4" /><span>Guardar Registro</span></>
                    ) : (
                      <><Pencil className="w-4 h-4" /><span>Editar</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Card 1: Datos Personales ──────────────────────────────── */}
              <SectionCard
                title="Datos Personales"
                className={isActivo ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'}
                headerClassName={isActivo ? 'bg-emerald-100/90 border-emerald-200' : 'bg-red-100/90 border-red-200'}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* 1. CUIL */}
                  <FormField
                    label="CUIL"
                    value={selected.cuil}
                    placeholder="20-00000000-0"
                    readOnly={true}
                  />
                  {/* 2. DNI */}
                  <FormField
                    label="DNI"
                    value={selected.dni}
                    placeholder="Número de DNI"
                    readOnly={true}
                  />
                  {/* 3. Apellido y Nombres */}
                  <FormField
                    label="Apellido y Nombres"
                    value={selected.nombreCompleto}
                    placeholder="Apellido y Nombres"
                    className="col-span-2"
                    readOnly={true}
                  />
                  {/* 4. Teléfono + Botón WhatsApp */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                      Teléfono
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={selected.telefono}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '')
                          update('telefono', raw)
                        }}
                        readOnly={!editing}
                        placeholder="Número de teléfono"
                        autoComplete="off"
                        className={`flex-1 min-w-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition ${
                          !editing ? 'bg-slate-50 text-slate-500 cursor-default' : 'bg-white text-slate-800'
                        }`}
                      />
                      {selected.telefono && (
                        <a
                          href={`https://wa.me/549${selected.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Enviar WhatsApp a ${selected.telefono}`}
                          className="flex items-center justify-center px-2.5 py-1.5 rounded-md bg-[#25D366] hover:bg-[#1da851] text-white transition flex-shrink-0 shadow-sm"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  {/* 5. Correo Electrónico */}
                  <FormField
                    label="Correo Electrónico"
                    value={selected.correo}
                    placeholder="correo@ejemplo.com"
                    className="col-span-2"
                    readOnly={true}
                  />
                  {/* 6. Programa */}
                  <FormField
                    label="Programa"
                    value={selected.programa}
                    placeholder="Programa"
                    readOnly={true}
                  />
                  {/* 7. Secretaría */}
                  <FormField
                    label="Secretaría"
                    value={selected.secretaria}
                    placeholder="Secretaría"
                    readOnly={true}
                  />
                  {/* 8. Cargo */}
                  <FormField
                    label="Cargo"
                    value={selected.cargo}
                    placeholder="Cargo desempeñado"
                    readOnly={true}
                  />
                  {/* 9. Antigüedad Actual */}
                  <FormField
                    label="Antigüedad Actual"
                    value={selected.antiguedadRecibo}
                    placeholder="Ej: 25 años, 4 meses"
                    readOnly={true}
                  />
                  {/* 10. Antigüedad al 31/12 */}
                  <FormField
                    label="Antigüedad al 31/12"
                    value={selected.antiguedadLicencias}
                    placeholder="Ej: 1 año, 2 meses"
                    readOnly={true}
                  />
                  {/* 11. Fecha de Nacimiento */}
                  <FormField
                    label="Fecha de Nacimiento"
                    value={selected.fechaNacimiento}
                    placeholder="dd/mm/aaaa"
                    mask="date"
                    readOnly={true}
                  />
                  {/* 12. Edad Actual */}
                  <FormField
                    label="Edad Actual"
                    value={selected.edadActual}
                    placeholder="Ej: 65"
                    readOnly={true}
                  />
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
