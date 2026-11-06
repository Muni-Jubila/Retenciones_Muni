'use client'

import { useState } from 'react'
import { FileText, Loader2, Users, X } from 'lucide-react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
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

interface DatosEmbargo {
  embargo: Embargo
  retenciones: RetencionEmbargo[]
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

function estadoLabel(estado: string): string {
  return ESTADOS_EMBARGO.find((item) => item.value === estado)?.label ?? estado
}

function promedioMensual(retenciones: RetencionEmbargo[]): number {
  if (retenciones.length === 0) return 0
  const total = retenciones.reduce(
    (acc, item) => acc + (item.retencionMensual || item.retencionSueldo + item.retencionRefrigerio),
    0,
  )
  return roundMoney(total / retenciones.length)
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  org: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#1e3a8a',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  area: {
    fontSize: 8.5,
    color: '#475569',
    marginTop: 2,
  },
  meta: {
    alignItems: 'flex-end',
  },
  metaStrong: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#475569',
  },
  metaText: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172554',
    marginTop: 4,
  },
  line: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#0f172a',
    marginTop: 3,
    marginBottom: 10,
  },
  agentCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#172554',
    textAlign: 'center',
    marginBottom: 6,
  },
  agentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  agentField: {
    width: '33.33%',
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
  },
  fieldLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  fieldValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 1,
  },
  embargo: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  embargoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  embargoHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  embargoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  autos: {
    fontSize: 8.5,
    color: '#475569',
    marginTop: 2,
  },
  estadoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estadoLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginRight: 4,
  },
  estadoBadge: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    color: '#1e3a8a',
    fontSize: 8.5,
    fontWeight: 'bold',
    paddingVertical: 3,
    paddingHorizontal: 8,
    minWidth: 56,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dataCard: {
    width: '31%',
    marginHorizontal: 3,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 5,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  totalCard: {
    width: '30%',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  obsCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    padding: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  obsLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#1e3a8a',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  obsText: {
    fontSize: 8.5,
    color: '#334155',
    textAlign: 'center',
    marginTop: 2,
  },
  detailTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e3a8a',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  table: {
    width: '94%',
    alignSelf: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
  },
  th: {
    color: '#ffffff',
    fontSize: 6.5,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  trAlt: {
    backgroundColor: '#f8fafc',
  },
  td: {
    fontSize: 7.5,
    color: '#0f172a',
    textAlign: 'center',
    paddingVertical: 3,
  },
  tfoot: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    borderTopWidth: 1.5,
    borderTopColor: '#1e3a8a',
  },
  tf: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    paddingVertical: 3,
  },
  empty: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 6,
  },
})

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.agentField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  )
}

function TarjetaDato({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  )
}

function TarjetaTotal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

function TablaRetenciones({ retenciones }: { retenciones: RetencionEmbargo[] }) {
  if (retenciones.length === 0) {
    return <Text style={styles.empty}>Sin retenciones registradas para este embargo.</Text>
  }

  const totalSueldo = retenciones.reduce((acc, item) => acc + item.retencionSueldo, 0)
  const totalRefrigerio = retenciones.reduce((acc, item) => acc + item.retencionRefrigerio, 0)
  const totalRetenido = retenciones.reduce(
    (acc, item) => acc + (item.retencionMensual || item.retencionSueldo + item.retencionRefrigerio),
    0,
  )
  const ultimoSaldo = retenciones[retenciones.length - 1]?.saldo ?? 0

  const columnas = [
    { label: 'Mes', width: '20%' },
    { label: 'Ret. Sueldo', width: '20%' },
    { label: 'Ret. Refrigerio', width: '24%' },
    { label: 'Ret. Total', width: '18%' },
    { label: 'Saldo', width: '18%' },
  ]

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {columnas.map((columna) => (
          <Text key={columna.label} style={[styles.th, { width: columna.width }]}>
            {columna.label}
          </Text>
        ))}
      </View>
      {retenciones.map((item, index) => (
        <View key={item.id} style={[styles.tr, index % 2 === 1 ? styles.trAlt : {}]}>
          <Text style={[styles.td, { width: columnas[0].width }]}>{periodoLabel(item.periodo)}</Text>
          <Text style={[styles.td, { width: columnas[1].width }]}>{formatMoney(item.retencionSueldo)}</Text>
          <Text style={[styles.td, { width: columnas[2].width }]}>{formatMoney(item.retencionRefrigerio)}</Text>
          <Text style={[styles.td, { width: columnas[3].width }]}>
            {formatMoney(item.retencionMensual || item.retencionSueldo + item.retencionRefrigerio)}
          </Text>
          <Text style={[styles.td, { width: columnas[4].width }]}>{formatMoney(item.saldo)}</Text>
        </View>
      ))}
      <View style={styles.tfoot}>
        <Text style={[styles.tf, { width: columnas[0].width }]}>Totales</Text>
        <Text style={[styles.tf, { width: columnas[1].width }]}>{formatMoney(totalSueldo)}</Text>
        <Text style={[styles.tf, { width: columnas[2].width }]}>{formatMoney(totalRefrigerio)}</Text>
        <Text style={[styles.tf, { width: columnas[3].width }]}>{formatMoney(totalRetenido)}</Text>
        <Text style={[styles.tf, { width: columnas[4].width }]}>{formatMoney(ultimoSaldo)}</Text>
      </View>
    </View>
  )
}

function ReportePdf({ agente, datos }: { agente: Empleado; datos: DatosEmbargo[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.org}>Subsecretaría de Capital Humano</Text>
            <Text style={styles.area}>Área Retenciones</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaStrong}>Consulta de Embargos</Text>
            <Text style={styles.metaText}>{fechaHora()}</Text>
          </View>
        </View>

        <Text style={styles.title}>Consulta de Embargos por Agente</Text>
        <View style={styles.line} />

        <View style={styles.agentCard}>
          <Text style={styles.cardTitle}>Datos del agente</Text>
          <View style={styles.agentGrid}>
            <Dato label="Nombre completo" value={agente.nombreCompleto} />
            <Dato label="DNI" value={agente.dni} />
            <Dato label="CUIL" value={agente.cuil} />
            <Dato label="Programa" value={agente.programa} />
            <Dato label="Cargo" value={agente.cargo} />
            <Dato label="Repartición" value={agente.secretaria} />
          </View>
        </View>

        {datos.map((item, index) => {
          const { embargo, retenciones } = item
          const promedio = promedioMensual(retenciones)
          return (
            <View key={embargo.id} break={index > 0} wrap={false} style={styles.embargo}>
              <View style={styles.embargoHeader}>
                <View style={styles.embargoHeaderLeft}>
                  <Text style={styles.embargoTitle}>
                    Embargo {index + 1} — Exp. Retenciones N° {embargo.expedienteRetenciones || 's/n'}
                  </Text>
                  <Text style={styles.autos}>{embargo.autos || 'Sin autos'}</Text>
                </View>
                <View style={styles.estadoWrap}>
                  <Text style={styles.estadoLabel}>Estado:</Text>
                  <Text style={styles.estadoBadge}>{estadoLabel(embargo.estado)}</Text>
                </View>
              </View>

              <View style={styles.dataGrid}>
                <TarjetaDato label="Expediente Judicial N°" value={embargo.expediente} />
                <TarjetaDato label="Fecha expediente" value={embargo.fechaExpediente} />
                <TarjetaDato label="Cuenta N°" value={embargo.cuenta} />
                <TarjetaDato label="Sucursal" value={embargo.sucursal} />
                <TarjetaDato label="Juzgado" value={embargo.juez} />
                <TarjetaDato label="Juez" value={embargo.secretaria} />
                <TarjetaDato label="Retención Mensual Promedio" value={formatMoney(promedio)} />
                <TarjetaDato label="Fecha de alta" value={embargo.fechaAlta} />
                <TarjetaDato label="Fecha de baja" value={embargo.fechaBaja} />
                <TarjetaDato label="Motivo de baja" value={embargo.motivoBaja} />
              </View>

              <View style={styles.totalsRow}>
                <TarjetaTotal label="Total retenido" value={formatMoney(embargo.totalRetenido)} />
                <TarjetaTotal label="Deuda" value={formatMoney(embargo.deuda)} />
                <TarjetaTotal label="Saldo pendiente" value={formatMoney(embargo.saldoActual)} />
              </View>

              <View style={styles.obsCard}>
                <Text style={styles.obsLabel}>Observaciones</Text>
                <Text style={styles.obsText}>{embargo.observaciones || '—'}</Text>
              </View>

              <Text style={styles.detailTitle}>Detalle de retenciones</Text>
              <TablaRetenciones retenciones={retenciones} />
            </View>
          )
        })}
      </Page>
    </Document>
  )
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

      const sufijo =
        alcance === 'SELECCIONADO' ? 'seleccionado' : alcance === 'ACTIVO_ESPERA' ? 'activos-espera' : 'todos'
      const blob = await pdf(<ReportePdf agente={agente} datos={datos} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `consulta-embargos-${agente.dni || 'agente'}-${sufijo}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setLoading(false)
      onClose()
    } catch {
      setError('No se pudo generar el PDF. Intentá nuevamente.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
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

        <div className="space-y-2 p-4">
          <button
            type="button"
            onClick={() => void consultar('SELECCIONADO')}
            disabled={!selected || loading}
            className="flex w-full items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2.5 text-left text-xs font-semibold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-left text-xs font-semibold text-[#1e3a8a] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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
