'use client'

import { useState } from 'react'
import { FilePlus2, FileText, Save, X } from 'lucide-react'
import {
  ESTADOS_EMBARGO,
  formatExpedienteRetencionesInput,
  moneyToInput,
  parseExpedienteRetenciones,
  parseMoneyInput,
  type Embargo,
  type EmbargoInput,
} from '@/lib/embargos'
import type { Empleado } from '@/lib/empleados'
import { formatDate, formatLetrasSinNumeros, getDateValidationError } from '@/lib/format-utils'
import { Banner, MoneyField, SelectField, TextField } from '@/components/embargos/ui'

interface EmbargoFormProps {
  agente: Empleado
  initial?: Embargo | null
  /** Datos detectados en un oficio judicial que se usan al crear el embargo. */
  prefill?: Partial<EmbargoInput> | null
  oficioUrl?: string | null
  oficioNombre?: string | null
  saving: boolean
  error?: string | null
  field?: string | null
  onCancel: () => void
  onSubmit: (input: EmbargoInput) => void
}

function fromEmbargo(
  agente: Empleado,
  initial?: Embargo | null,
  prefill?: Partial<EmbargoInput> | null,
): EmbargoInput {
  const base: EmbargoInput = {
    estado: initial?.estado ?? '',
    autos: initial?.autos ?? '',
    expediente: (initial?.expediente ?? '').replace(/\D/g, ''),
    expedienteRetenciones: initial?.expedienteRetenciones ?? '',
    fechaExpediente: initial?.fechaExpediente ?? '',
    cuenta: (initial?.cuenta ?? '').replace(/\D/g, '').slice(0, 8),
    sucursal: initial?.sucursal ?? '',
    juez: initial?.juez ?? '',
    instancia: initial?.instancia ?? '',
    nomenclatura: initial?.nomenclatura ?? '',
    tipoProceso: initial?.tipoProceso ?? '',
    secretaria: initial?.secretaria ?? '',
    deuda: initial?.deuda ? moneyToInput(initial.deuda) : '',
    importeMensual: initial?.importeMensual ? moneyToInput(initial.importeMensual) : '',
    porcentaje: initial?.porcentaje ? moneyToInput(initial.porcentaje) : '',
    marcaEspecial: initial?.marcaEspecial ?? '',
    observaciones: initial?.observaciones ?? '',
    idAgente: agente.id,
  }
  if (!prefill) return base

  return {
    ...base,
    ...prefill,
    expediente: (prefill.expediente ?? base.expediente).replace(/\D/g, ''),
    cuenta: (prefill.cuenta ?? base.cuenta).replace(/\D/g, '').slice(0, 8),
    juez: prefill.juez ?? base.juez,
    secretaria: prefill.secretaria ?? base.secretaria,
    expedienteRetenciones: prefill.expedienteRetenciones ?? base.expedienteRetenciones,
    idAgente: agente.id,
  }
}

export default function EmbargoForm({
  agente,
  initial,
  prefill,
  oficioUrl,
  oficioNombre,
  saving,
  error,
  field,
  onCancel,
  onSubmit,
}: EmbargoFormProps) {
  const [form, setForm] = useState<EmbargoInput>(() => fromEmbargo(agente, initial, prefill))
  const [localError, setLocalError] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const update = (key: keyof EmbargoInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrores((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /**
   * Aplica una máscara y, si el operador escribió algo que no corresponde,
   * deja el campo marcado para que se vea el borde rojo.
   */
  const updateMascara = (
    key: keyof EmbargoInput,
    raw: string,
    limpio: string,
    mensaje: string,
    invalido: boolean,
  ) => {
    setForm((prev) => ({ ...prev, [key]: limpio }))
    setErrores((prev) => {
      const next = { ...prev }
      if (invalido && raw.trim() !== '') next[key] = mensaje
      else delete next[key]
      return next
    })
  }

  const errorDe = (key: string): string | null =>
    errores[key] ?? (field === key ? error ?? null : null)

  const handleFechaChange = (value: string) => {
    const limpio = formatDate(value)
    const errorFecha = getDateValidationError(limpio, false)
    const formatoInvalido = /[^0-9/\s.-]/.test(value) || value.replace(/\D/g, '').length > 8
    const mensaje = errorFecha ?? (formatoInvalido ? 'Usá el formato dd/mm/aaaa.' : '')
    updateMascara('fechaExpediente', value, limpio, mensaje, Boolean(errorFecha) || formatoInvalido)
  }

  const validarFormulario = (): Record<string, string> => {
    const next: Record<string, string> = {}
    if (!form.expediente.trim() && !form.autos.trim()) {
      next.autos = 'Ingresá al menos los autos o el número de expediente judicial.'
    }
    if (form.expediente.trim() && !/^\d{1,8}$/.test(form.expediente.trim())) {
      next.expediente = 'Solo números, máximo 8 dígitos.'
    }
    if (form.expedienteRetenciones.trim() && parseExpedienteRetenciones(form.expedienteRetenciones) === null) {
      next.expedienteRetenciones = 'Usá el formato 000.000/00 (máximo 8 dígitos).'
    }
    const fechaError = getDateValidationError(form.fechaExpediente, true)
    if (fechaError) next.fechaExpediente = fechaError
    if (form.cuenta.trim() && !/^\d{1,8}$/.test(form.cuenta.trim())) {
      next.cuenta = 'Solo números, máximo 8 dígitos.'
    }
    if (/\d/.test(form.secretaria)) next.secretaria = 'El Juez no puede contener números.'
    const deuda = parseMoneyInput(form.deuda)
    if (deuda < 0) next.deuda = 'La deuda no puede ser negativa.'
    const importe = parseMoneyInput(form.importeMensual)
    if (importe < 0) next.importeMensual = 'El importe mensual no puede ser negativo.'
    const porcentaje = parseMoneyInput(form.porcentaje)
    if (form.porcentaje.trim() && (porcentaje < 0 || porcentaje > 100)) {
      next.porcentaje = 'El porcentaje debe estar entre 0 y 100.'
    }
    return next
  }

  const handleSubmit = () => {
    setLocalError(null)
    const nuevosErrores = validarFormulario()
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) {
      setLocalError('Revisá los campos marcados en rojo: hay datos incompletos o con formato incorrecto.')
      return
    }
    onSubmit(form)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-[#1e3a8a] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <FilePlus2 className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-bold">{initial ? 'Modificar embargo' : 'Nuevo embargo'}</h3>
            <p className="text-[10px] text-blue-200">
              {initial
                ? `Exp. judicial ${initial.expediente || 's/n'} · Exp. retenciones ${initial.expedienteRetenciones || 's/n'}`
                : 'Complete los datos en esta misma pantalla o importe un oficio judicial.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {oficioUrl && (
            <a
              href={oficioUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-white/20"
              title={oficioNombre ?? 'Abrir oficio judicial'}
            >
              <FileText className="h-3 w-3" />
              Ver oficio
            </a>
          )}
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
            Estado: {initial ? ESTADOS_EMBARGO.find((item) => item.value === form.estado)?.label ?? '—' : 'Automático'}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {(localError || error) && <Banner tone="error" onClose={() => setLocalError(null)}>{localError ?? error}</Banner>}
        {prefill && (
          <Banner tone="info">
            Los datos se completaron automáticamente desde el oficio judicial. Revisá la vista previa del PDF y corregí
            cualquier campo antes de guardar.
          </Banner>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200">
          <h4 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]">
            Datos personales
          </h4>
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
            <TextField label="Agente" value={agente.nombreCompleto} onChange={() => {}} readOnly />
            <TextField label="Documento" value={agente.dni} onChange={() => {}} readOnly />
            <TextField label="Cargo" value={agente.cargo} onChange={() => {}} readOnly />
            <TextField label="Programa" value={agente.programa} onChange={() => {}} readOnly />
            <TextField label="Repartición" value={agente.secretaria} onChange={() => {}} readOnly className="col-span-2 md:col-span-4" />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200">
          <h4 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]">
            Datos del expediente y del juicio
          </h4>
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
            <label className="col-span-2 flex flex-col gap-1 md:col-span-4">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Autos
              </span>
              <textarea
                value={form.autos}
                onChange={(event) => update('autos', event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ej: FREIRE, JUAN MANUEL C/ CACERES, RODRIGO GUSTAVO"
                className={`resize-none rounded-md border px-2.5 py-1.5 text-sm transition ${
                  errores.autos
                    ? 'border-rose-500 bg-rose-50/40 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200'
                }`}
              />
              {errores.autos && <span className="text-[10px] font-semibold text-rose-600">{errores.autos}</span>}
            </label>
            <TextField
              label="Expediente Judicial N°"
              value={form.expediente}
              onChange={(value) =>
                updateMascara(
                  'expediente',
                  value,
                  value.replace(/\D/g, '').slice(0, 8),
                  'Solo números, máximo 8 dígitos.',
                  /[^\d./\s-]/.test(value) || value.replace(/\D/g, '').length > 8,
                )
              }
              placeholder="Ej: 00614826"
              maxLength={20}
              hint="Solo números, hasta 8 dígitos."
              error={errorDe('expediente')}
            />
            <TextField
              label="Expediente Retenciones N°"
              value={form.expedienteRetenciones}
              onChange={(value) =>
                updateMascara(
                  'expedienteRetenciones',
                  value,
                  formatExpedienteRetencionesInput(value),
                  'Usá el formato 000.000/00 (máximo 8 dígitos).',
                  /[^0-9./\s-]/.test(value) || value.replace(/\D/g, '').length > 8,
                )
              }
              placeholder={initial ? '—' : '000.000/00'}
              maxLength={10}
              hint={initial ? 'Formato 000.000/00. Se puede modificar.' : 'Correlativo automático si lo dejás vacío.'}
              error={errorDe('expedienteRetenciones')}
            />
            <TextField
              label="Fecha expediente"
              value={form.fechaExpediente}
              onChange={handleFechaChange}
              placeholder="dd/mm/aaaa"
              maxLength={10}
              error={errorDe('fechaExpediente')}
            />
            <TextField
              label="Suc."
              value={form.sucursal}
              onChange={(value) => update('sucursal', value)}
              placeholder="Sucursal"
              maxLength={50}
            />
            <TextField
              label="Cuenta N°"
              value={form.cuenta}
              onChange={(value) => update('cuenta', value.replace(/\D/g, '').slice(0, 8))}
              placeholder="15367884"
              maxLength={8}
              hint="Solo números, hasta 8 dígitos."
              error={errorDe('cuenta')}
            />
            <TextField
              label="Juzgado"
              value={form.juez}
              onChange={(value) => update('juez', value)}
              placeholder="Juzgado / organismo"
              maxLength={255}
              error={errorDe('juez')}
            />
            <TextField
              label="Juez"
              value={form.secretaria}
              onChange={(value) =>
                updateMascara(
                  'secretaria',
                  value,
                  formatLetrasSinNumeros(value).slice(0, 100),
                  'El Juez solo admite letras, sin números.',
                  /\d/.test(value),
                )
              }
              placeholder="Nombre del juez"
              maxLength={100}
              error={errorDe('secretaria')}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200">
          <h4 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]">
            Importes y estado
          </h4>
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
            <MoneyField
              label="Deuda"
              value={form.deuda}
              onChange={(value) => update('deuda', value)}
              hint="Importe total del embargo."
              error={errorDe('deuda')}
            />
            {initial && initial.estado !== 'BAJA' && initial.estado !== 'CANCELADO' ? (
              <SelectField
                label="Estado"
                value={form.estado === 'CANCELADO' ? 'CANCELADO' : ''}
                onChange={(value) => update('estado', value || initial.estado)}
                options={[
                  {
                    value: '',
                    label: `Mantener ${ESTADOS_EMBARGO.find((item) => item.value === initial.estado)?.label ?? initial.estado}`,
                  },
                  { value: 'CANCELADO', label: 'C · Cancelado' },
                ]}
                hint="Solo podés cancelar el embargo. Activo, en espera y baja se asignan automáticamente."
              />
            ) : initial ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estado</span>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600">
                  {ESTADOS_EMBARGO.find((item) => item.value === initial.estado)?.label ?? initial.estado}
                </div>
                <span className="text-[10px] text-slate-400">Este embargo ya está cerrado.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estado</span>
                <div className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-sm font-semibold text-[#1e3a8a]">
                  Se asigna automáticamente
                </div>
                <span className="text-[10px] text-slate-400">
                  Activo si es el primer embargo del agente; en espera si ya tiene otro anterior.
                </span>
              </div>
            )}
            <label className="col-span-2 flex flex-col gap-1 md:col-span-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Observaciones</span>
              <textarea
                value={form.observaciones}
                onChange={(event) => update('observaciones', event.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Notas internas, oficios, incidencias..."
                className="resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 transition focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <p className="mr-auto text-[10px] text-slate-400">
          Ingresá al menos autos o expediente judicial. El saldo se calcula automáticamente con las retenciones.
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear embargo'}
        </button>
      </div>
    </div>
  )
}
