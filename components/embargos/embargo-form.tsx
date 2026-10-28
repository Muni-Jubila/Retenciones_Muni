'use client'

import { useState } from 'react'
import { FilePlus2, FileText, Save, X } from 'lucide-react'
import { ESTADOS_EMBARGO, type Embargo, type EmbargoInput } from '@/lib/embargos'
import type { Empleado } from '@/lib/empleados'
import { formatDate } from '@/lib/format-utils'
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
  return {
    estado: initial?.estado ?? 'ESPERA',
    autos: initial?.autos ?? '',
    expediente: initial?.expediente ?? '',
    fechaExpediente: initial?.fechaExpediente ?? '',
    cuenta: initial?.cuenta ?? '',
    sucursal: initial?.sucursal ?? '',
    juez: initial?.juez ?? '',
    instancia: initial?.instancia ?? '',
    nomenclatura: initial?.nomenclatura ?? '',
    tipoProceso: initial?.tipoProceso ?? '',
    secretaria: initial?.secretaria ?? agente.secretaria,
    deuda: initial?.deuda ? String(initial.deuda).replace('.', ',') : '',
    importeMensual: initial?.importeMensual ? String(initial.importeMensual).replace('.', ',') : '',
    porcentaje: initial?.porcentaje ? String(initial.porcentaje).replace('.', ',') : '',
    marcaEspecial: initial?.marcaEspecial ?? '',
    observaciones: initial?.observaciones ?? '',
    ...prefill,
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

  const update = (key: keyof EmbargoInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    setLocalError(null)
    if (!form.expediente.trim() && !form.autos.trim()) {
      setLocalError('Ingrese al menos los autos o el número de expediente judicial.')
      return
    }
    if (form.fechaExpediente.trim() && !/^\d{2}\/\d{2}\/\d{4}$/.test(form.fechaExpediente.trim())) {
      setLocalError('La fecha del expediente debe tener el formato dd/mm/aaaa.')
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
            Estado: {ESTADOS_EMBARGO.find((item) => item.value === form.estado)?.label}
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
                className="resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 transition focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <TextField
              label="Expediente Judicial N°"
              value={form.expediente}
              onChange={(value) => update('expediente', value)}
              placeholder="006.148/26"
              maxLength={100}
              error={field === 'expediente' ? error : null}
            />
            <TextField
              label="Expediente Retenciones N°"
              value={initial?.expedienteRetenciones ?? ''}
              onChange={() => {}}
              readOnly
              placeholder={initial ? '—' : 'Se asigna automáticamente'}
              hint={initial ? 'N° interno de retenciones.' : 'Correlativo automático al guardar (000.000/000).'}
            />
            <TextField
              label="Fecha expediente"
              value={form.fechaExpediente}
              onChange={(value) => update('fechaExpediente', formatDate(value))}
              placeholder="dd/mm/aaaa"
              maxLength={10}
              error={field === 'fechaExpediente' ? error : null}
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
              onChange={(value) => update('cuenta', value)}
              placeholder="153678/4"
              maxLength={100}
            />
            <TextField
              label="Juez de"
              value={form.juez}
              onChange={(value) => update('juez', value)}
              placeholder="Juzgado / organismo"
              maxLength={255}
            />
            <TextField label="Inst. y" value={form.instancia} onChange={(value) => update('instancia', value)} placeholder="Instancia" maxLength={50} />
            <TextField label="Nom." value={form.nomenclatura} onChange={(value) => update('nomenclatura', value)} placeholder="Nomenclatura" maxLength={255} />
            <TextField label="T." value={form.tipoProceso} onChange={(value) => update('tipoProceso', value)} placeholder="P.U.E." maxLength={20} />
            <TextField
              label="Secretaría judicial"
              value={form.secretaria}
              onChange={(value) => update('secretaria', value)}
              placeholder="Número / detalle"
              maxLength={100}
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
              error={field === 'deuda' ? error : null}
            />
            <TextField
              label="Marca especial"
              value={form.marcaEspecial}
              onChange={(value) => update('marcaEspecial', value)}
              placeholder="Opcional"
              maxLength={10}
            />
            <SelectField
              label="Estado del registro"
              value={form.estado}
              onChange={(value) => update('estado', value)}
              options={ESTADOS_EMBARGO.map((item) => ({ value: item.value, label: `${item.letra} · ${item.label}` }))}
              hint="E = espera · A = activo · B = baja · C = cancelado"
            />
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
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear embargo'}
        </button>
      </div>
    </div>
  )
}
