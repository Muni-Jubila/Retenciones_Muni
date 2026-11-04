'use client'

import { useState } from 'react'
import { FileText, Loader2, Users, X } from 'lucide-react'
import { listarRetenciones } from '@/app/actions/embargos'
import {
  ESTADOS_EMBARGO,
  formatMoney,
  periodoLabel,
  roundMoney,
  type Embargo,
  type RetencionEmbargo,
} from '@/lib/embargos'
import type { Empleado } from '@/lib/empleados'

interface ConsultaEmbargoProps {
  open: boolean
  agente: Empleado
  embargos: Embargo[]
  selected: Embargo | null
  onClose: () => void
}

type Alcance = 'SELECCIONADO' | 'ACTIVO_ESPERA' | 'TODOS'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function fechaHora(): string {
  return new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fechaOrdenable(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return value.trim()
  return `${match[3]}${match[2]}${match[1]}`
}

function ordenarActivosEspera(embargos: Embargo[]): Embargo[] {
  const prioridad: Record<string, number> = { ACTIVO: 0, ESPERA: 1 }
  return embargos
    .filter((embargo) => embargo.estado === 'ACTIVO' || embargo.estado === 'ESPERA')
    .sort((a, b) => {
      const prioridadA = prioridad[a.estado] ?? 9
      const prioridadB = prioridad[b.estado] ?? 9
      if (prioridadA !== prioridadB) return prioridadA - prioridadB
      const fechaA = fechaOrdenable(a.fechaAlta)
      const fechaB = fechaOrdenable(b.fechaAlta)
      if (fechaA !== fechaB) return fechaA.localeCompare(fechaB)
      return a.id - b.id
    })
}

function datoHtml(label: string, value: unknown): string {
  const texto = String(value ?? '').trim()
  return `<div class="dato"><span>${escapeHtml(label)}</span><strong>${texto ? escapeHtml(texto) : '—'}</strong></div>`
}

function promedioMensual(retenciones: RetencionEmbargo[]): number {
  if (retenciones.length === 0) return 0
  const total = retenciones.reduce(
    (acc, item) => acc + (item.retencionMensual || item.retencionSueldo + item.retencionRefrigerio),
    0,
  )
  return roundMoney(total / retenciones.length)
}

function retencionesHtml(retenciones: RetencionEmbargo[]): string {
  if (retenciones.length === 0) {
    return '<p class="vacio">Sin retenciones registradas para este embargo.</p>'
  }

  const totalSueldo = retenciones.reduce((acc, item) => acc + item.retencionSueldo, 0)
  const totalRefrigerio = retenciones.reduce((acc, item) => acc + item.retencionRefrigerio, 0)
  const totalRetenido = retenciones.reduce(
    (acc, item) => acc + (item.retencionMensual || item.retencionSueldo + item.retencionRefrigerio),
    0,
  )
  const ultimoSaldo = retenciones[retenciones.length - 1]?.saldo ?? 0

  const filas = retenciones
    .map(
      (item) => `<tr>
        <td>${escapeHtml(periodoLabel(item.periodo))}</td>
        <td class="num">${escapeHtml(formatMoney(item.retencionSueldo))}</td>
        <td class="num">${escapeHtml(formatMoney(item.retencionRefrigerio))}</td>
        <td class="num">${escapeHtml(formatMoney(item.retencionMensual || item.retencionSueldo + item.retencionRefrigerio))}</td>
        <td class="num">${escapeHtml(formatMoney(item.saldo))}</td>
      </tr>`,
    )
    .join('')

  return `<table>
    <thead>
      <tr>
        <th>Mes</th>
        <th class="num">Ret. Sueldo</th>
        <th class="num">Ret. Refrigerio</th>
        <th class="num">Ret. Total</th>
        <th class="num">Saldo</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr>
        <td>Totales</td>
        <td class="num">${escapeHtml(formatMoney(totalSueldo))}</td>
        <td class="num">${escapeHtml(formatMoney(totalRefrigerio))}</td>
        <td class="num">${escapeHtml(formatMoney(totalRetenido))}</td>
        <td class="num">${escapeHtml(formatMoney(ultimoSaldo))}</td>
      </tr>
    </tfoot>
  </table>`
}

function embargoHtml(
  embargo: Embargo,
  retenciones: RetencionEmbargo[],
  index: number,
  saltoPagina: boolean,
): string {
  const estado = ESTADOS_EMBARGO.find((item) => item.value === embargo.estado)?.label ?? embargo.estado
  const expRet = embargo.expedienteRetenciones || 's/n'
  const promedio = promedioMensual(retenciones)

  return `<section class="embargo${saltoPagina ? ' salto-pagina' : ''}">
    <div class="embargo-head">
      <div>
        <h2>Embargo ${index + 1} — Exp. Retenciones N° ${escapeHtml(expRet)}</h2>
        <p>${escapeHtml(embargo.autos || 'Sin autos')}</p>
      </div>
      <div class="estado-wrap">
        <span class="estado-label">Estado:</span>
        <span class="estado">${escapeHtml(estado)}</span>
      </div>
    </div>
    <div class="grid">
      ${datoHtml('Expediente Judicial N°', embargo.expediente)}
      ${datoHtml('Fecha expediente', embargo.fechaExpediente)}
      ${datoHtml('Cuenta N°', embargo.cuenta)}
      ${datoHtml('Sucursal', embargo.sucursal)}
      ${datoHtml('Juzgado', embargo.juez)}
      ${datoHtml('Juez', embargo.secretaria)}
      ${datoHtml('Deuda', formatMoney(embargo.deuda))}
      ${datoHtml('Retención Mensual Promedio', formatMoney(promedio))}
      ${datoHtml('Fecha de alta', embargo.fechaAlta)}
      ${datoHtml('Fecha de baja', embargo.fechaBaja)}
      ${datoHtml('Motivo de baja', embargo.motivoBaja)}
    </div>
    <div class="totales">
      <div><span>Total retenido</span><strong>${escapeHtml(formatMoney(embargo.totalRetenido))}</strong></div>
      <div><span>Saldo pendiente</span><strong>${escapeHtml(formatMoney(embargo.saldoActual))}</strong></div>
    </div>
    <p class="obs"><span>Observaciones:</span> ${escapeHtml(embargo.observaciones || '—')}</p>
    <h3>Detalle de retenciones</h3>
    ${retencionesHtml(retenciones)}
  </section>`
}

function buildHtml(agente: Empleado, bloques: string): string {
  return `<div class="reporte">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #ffffff; }
    .reporte { width: 190mm; font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 10.5px; }
    .top { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 6px; }
    .org { margin: 0; font-size: 14px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: .04em; }
    .area { margin: 2px 0 0; color: #475569; font-size: 10px; }
    .meta { text-align: right; color: #475569; font-size: 9.5px; line-height: 1.5; }
    h1 { font-size: 17px; margin: 6px 0 4px; color: #172554; }
    .linea { border-top: 3px solid #0f172a; margin-bottom: 12px; }
    h2 { font-size: 12.5px; margin: 0; color: #172554; }
    h3 { font-size: 10px; margin: 12px 0 5px; color: #1e3a8a; text-transform: uppercase; letter-spacing: .05em; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-bottom: 14px; background: #f8fafc; }
    .card h2 { margin-bottom: 7px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px 12px; }
    .dato { min-width: 0; }
    .dato span { display: block; color: #64748b; font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
    .dato strong { display: block; margin-top: 1px; font-size: 10px; font-weight: 600; word-break: break-word; }
    .embargo { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-bottom: 14px; background: #ffffff; page-break-inside: avoid; }
    .salto-pagina { page-break-before: always; }
    .embargo-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 7px; margin-bottom: 8px; }
    .embargo-head p { margin: 3px 0 0; color: #475569; font-size: 9.5px; }
    .estado-wrap { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
    .estado-label { color: #475569; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .estado { border: 1px solid #93c5fd; background: #eff6ff; color: #1e3a8a; border-radius: 999px; padding: 4px 10px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
    .totales { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; }
    .totales div { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 6px 8px; }
    .totales span { display: block; color: #64748b; font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
    .totales strong { display: block; margin-top: 2px; font-size: 10.5px; }
    .obs { margin: 8px 0 0; color: #334155; font-size: 9.5px; line-height: 1.4; }
    .obs span { font-weight: 700; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th { background: #1e3a8a; color: #ffffff; text-align: left; padding: 4px 5px; font-size: 7.5px; text-transform: uppercase; letter-spacing: .04em; }
    td { border-bottom: 1px solid #e2e8f0; padding: 4px 5px; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tfoot td { background: #eef2ff; font-weight: 700; border-top: 2px solid #1e3a8a; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .vacio { color: #64748b; font-style: italic; padding: 6px 0; }
    .footer { margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 6px; color: #64748b; font-size: 8px; display: flex; justify-content: space-between; }
  </style>
    <div class="top">
      <div>
        <p class="org">Subsecretaría de Capital Humano</p>
        <p class="area">Área Retenciones</p>
      </div>
      <div class="meta">
        <div><strong>Consulta de Embargos</strong></div>
        <div>${escapeHtml(fechaHora())}</div>
      </div>
    </div>
    <h1>Consulta de Embargos por Agente</h1>
    <div class="linea"></div>
    <section class="card">
      <h2>Datos del agente</h2>
      <div class="grid">
        ${datoHtml('Nombre completo', agente.nombreCompleto)}
        ${datoHtml('DNI', agente.dni)}
        ${datoHtml('CUIL', agente.cuil)}
        ${datoHtml('Programa', agente.programa)}
        ${datoHtml('Cargo', agente.cargo)}
        ${datoHtml('Repartición', agente.secretaria)}
      </div>
    </section>
    ${bloques}
    <div class="footer">
      <span>Sistema de Retenciones — Municipalidad de Córdoba</span>
      <span>Documento generado automáticamente</span>
    </div>
  </div>`
}

export default function ConsultaEmbargo({ open, agente, embargos, selected, onClose }: ConsultaEmbargoProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const activosEspera = ordenarActivosEspera(embargos)

  const consultar = async (alcance: Alcance) => {
    if (alcance === 'SELECCIONADO' && !selected) return
    if (alcance === 'ACTIVO_ESPERA' && activosEspera.length === 0) return
    if (alcance === 'TODOS' && embargos.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const lista =
        alcance === 'SELECCIONADO' && selected
          ? [selected]
          : alcance === 'ACTIVO_ESPERA'
            ? activosEspera
            : embargos

      const datos = await Promise.all(
        lista.map(async (embargo) => ({
          embargo,
          retenciones: await listarRetenciones(embargo.id),
        })),
      )

      const bloques = datos
        .map((item, index) => embargoHtml(item.embargo, item.retenciones, index, index > 0))
        .join('')
      const html = buildHtml(agente, bloques)

      const mod = await import('html2pdf.js')
      const html2pdf = ((mod as { default?: unknown }).default ?? mod) as any
      const sufijo =
        alcance === 'SELECCIONADO' ? 'seleccionado' : alcance === 'ACTIVO_ESPERA' ? 'activos-espera' : 'todos'

      const contenedor = document.createElement('div')
      contenedor.style.position = 'fixed'
      contenedor.style.left = '-10000px'
      contenedor.style.top = '0'
      contenedor.style.width = '210mm'
      contenedor.style.background = '#ffffff'
      contenedor.innerHTML = html
      document.body.appendChild(contenedor)

      try {
        const objetivo = contenedor.firstElementChild as HTMLElement
        await html2pdf()
          .set({
            margin: 10,
            filename: `consulta-embargos-${agente.dni || 'agente'}-${sufijo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['section.embargo', 'tr'] },
          } as any)
          .from(objetivo)
          .save()
      } finally {
        document.body.removeChild(contenedor)
      }

      setLoading(false)
      onClose()
    } catch {
      setError('No se pudo generar el PDF. Intentá nuevamente.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <FileText className="h-4 w-4 text-[#1e3a8a]" />
              Consulta de embargos
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Elegí qué información querés descargar en PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 p-5">
          <button
            type="button"
            onClick={() => void consultar('SELECCIONADO')}
            disabled={!selected || loading}
            className="flex w-full items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-3 text-left text-xs font-semibold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span>
              Consulta del embargo seleccionado
              <span className="mt-0.5 block text-[10px] font-normal text-blue-100">
                {selected ? `Exp. Ret. ${selected.expedienteRetenciones || 's/n'}` : 'Seleccioná un embargo en la grilla'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => void consultar('ACTIVO_ESPERA')}
            disabled={activosEspera.length === 0 || loading}
            className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Users className="h-4 w-4 flex-shrink-0" />
            <span>
              Consulta Embargo Activo/Espera
              <span className="mt-0.5 block text-[10px] font-normal text-blue-700/70">
                {activosEspera.length} embargo{activosEspera.length !== 1 ? 's' : ''} activo
                {activosEspera.length !== 1 ? 's' : ''} o en espera
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => void consultar('TODOS')}
            disabled={embargos.length === 0 || loading}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4 flex-shrink-0 text-[#1e3a8a]" />
            <span>
              Consulta sobre todos los embargos
              <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                {embargos.length} embargo{embargos.length !== 1 ? 's' : ''} del agente
              </span>
            </span>
          </button>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando PDF...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
