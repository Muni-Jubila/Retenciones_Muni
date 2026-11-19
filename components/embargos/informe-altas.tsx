'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { contarEmbargosParaInforme } from '@/app/actions/embargos'
import { MEMBRETE_DATA_URL } from '@/lib/membrete-data'
import { formatMoney, type Embargo } from '@/lib/embargos'

interface ConteoEmbargos {
  activos: number
  espera: number
}

interface BotonInformeAltasProps {
  filas: Embargo[]
  loading?: boolean
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

function formatearDni(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 8) return value || '—'
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
}

function fechaHora(date: Date): string {
  return date.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function juzgadoTexto(value: string): string {
  const juzgado = value.trim()
  if (!juzgado) return 'el Juzgado interviniente'
  if (/^(sala|c[aá]mara)/i.test(juzgado)) return `la ${juzgado}`
  if (/^(juzgado|tga)/i.test(juzgado)) return `el ${juzgado}`
  return `el Juzgado de ${juzgado}`
}

function nombreArchivo(fila: Embargo, usados: Set<string>): string {
  const expediente = fila.expediente || fila.expedienteRetenciones || `embargo-${fila.id}`
  const persona = fila.agente || fila.dni || 'agente'
  const base = `Informe al Juzgado - ${expediente} - ${persona}`
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || `Informe-${fila.id}`
  let nombre = `${base}.pdf`
  let numero = 2
  while (usados.has(nombre.toLocaleLowerCase('es'))) {
    nombre = `${base} (${numero}).pdf`
    numero += 1
  }
  usados.add(nombre.toLocaleLowerCase('es'))
  return nombre
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 42,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  membrete: {
    width: '100%',
    height: 63,
    objectFit: 'contain',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a8a',
    paddingBottom: 5,
    marginBottom: 16,
  },
  area: {
    fontSize: 8.5,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    color: '#1e3a8a',
    textTransform: 'uppercase',
  },
  expLabel: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  expValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'right',
    marginTop: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#172554',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 18,
  },
  campoNombre: {
    flexGrow: 1,
    paddingRight: 12,
  },
  campoDni: {
    width: 105,
  },
  label: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  value: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  paragraph: {
    fontSize: 10.5,
    lineHeight: 1.55,
    textAlign: 'justify',
    marginBottom: 9,
  },
  strong: {
    fontWeight: 'bold',
  },
  closing: {
    fontSize: 10.5,
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    color: '#64748b',
  },
})

function InformeAltaPdf({
  fila,
  conteo,
  impreso,
}: {
  fila: Embargo
  conteo: ConteoEmbargos
  impreso: Date
}) {
  const incluyePresente = fila.estado === 'ACTIVO' || fila.estado === 'ESPERA'
  const conteoTexto = `${conteo.activos} en ejecución y ${conteo.espera} en espera${
    incluyePresente ? ' (incluye el presente oficio)' : ''
  }`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image src={MEMBRETE_DATA_URL} style={styles.membrete} />

        <View style={styles.headerRow}>
          <Text style={styles.area}>Sección Retenciones</Text>
          <View>
            <Text style={styles.expLabel}>Exp. Judicial</Text>
            <Text style={styles.expValue}>{fila.expediente || 's/n'}</Text>
          </View>
        </View>

        <Text style={styles.title}>Informe al Juzgado</Text>

        <View style={styles.card}>
          <View style={styles.campoNombre}>
            <Text style={styles.label}>Apellido y nombre</Text>
            <Text style={styles.value}>{(fila.agente || '—').toUpperCase()}</Text>
          </View>
          <View style={styles.campoDni}>
            <Text style={styles.label}>DNI</Text>
            <Text style={styles.value}>{formatearDni(fila.dni)}</Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          Por la presente, la Secc. Retenciones de la Subsecretaría de Capital Humano de la
          Municipalidad de Córdoba, cumple en informar que se ha tomado razón del{' '}
          <Text style={styles.strong}>OFICIO JUDICIAL</Text> tramitado ante{' '}
          {juzgadoTexto(fila.juez)} en los autos caratulados como:{' '}
          <Text style={styles.strong}>{(fila.autos || 'Sin autos').toUpperCase()}</Text>, con la
          orden expresa de <Text style={styles.strong}>TRABAR EMBARGOS</Text> en proporción
          determinada, la cual será aplicada sobre remuneración percibida hasta saldar la suma
          de: <Text style={styles.strong}>{formatMoney(fila.saldoActual)}</Text>, conforme al orden de
          prelación del presente oficio respecto de los embargos registrados para el agente:{' '}
          <Text style={styles.strong}>{conteoTexto}</Text>.
        </Text>

        <Text style={styles.closing}>
          Sirva la presente de atenta nota de elevación y estilo.
        </Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Impreso: {fechaHora(impreso)}</Text>
          <Text style={styles.footerText}>Fec. de Alta: {fila.fechaAlta || '—'}</Text>
        </View>
      </Page>
    </Document>
  )
}

export default function BotonInformeAltas({ filas, loading = false }: BotonInformeAltasProps) {
  const [generando, setGenerando] = useState(false)
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null)
  const [fase, setFase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const generar = async () => {
    if (filas.length === 0 || generando) return
    setError(null)
    setAviso(null)
    setFase('Abriendo selector de carpeta...')

    const pickerWindow = window as DirectoryPickerWindow
    if (typeof pickerWindow.showDirectoryPicker !== 'function') {
      setFase(null)
      setError('Este navegador no permite elegir una carpeta. Usá Chrome o Edge.')
      return
    }

    let directorio: FileSystemDirectoryHandle
    try {
      // Llamada directa sobre window: el método debe conservar su receptor.
      directorio = await pickerWindow.showDirectoryPicker({ mode: 'readwrite' })
      console.info('[informe-altas] Carpeta seleccionada')
    } catch (pickerError) {
      setFase(null)
      if (pickerError instanceof DOMException && pickerError.name === 'AbortError') return
      console.error('[informe-altas] No se pudo abrir el selector de carpeta', pickerError)
      setError('No se pudo abrir el selector de carpeta.')
      return
    }

    // Se activa apenas vuelve el selector, antes de cualquier otra espera, para
    // que el botón muestre progreso aunque la consulta a la base demore.
    setGenerando(true)
    setProgreso({ hechos: 0, total: filas.length })
    setFase('Verificando permisos de escritura...')

    // Prueba mínima de escritura: si la carpeta no permite crear archivos,
    // avisa antes de intentar generar 48 PDFs.
    try {
      const prueba = await directorio.getFileHandle('retenciones-prueba.tmp', { create: true })
      const pruebaWritable = await prueba.createWritable()
      await pruebaWritable.write('ok')
      await pruebaWritable.close()
      await directorio.removeEntry('retenciones-prueba.tmp')
    } catch (writeError) {
      console.error('[informe-altas] No se puede escribir en la carpeta', writeError)
      setGenerando(false)
      setProgreso(null)
      setFase(null)
      setError(
        'No se pudo escribir en la carpeta elegida. Verificá que no sea una carpeta protegida o de solo lectura.',
      )
      return
    }

    setFase('Preparando informes...')
    let completados = 0

    try {
      const conteos = await contarEmbargosParaInforme(filas.map((fila) => fila.idAgente))
      const impreso = new Date()
      const usados = new Set<string>()

      for (const fila of filas) {
        const blob = await pdf(
          <InformeAltaPdf
            fila={fila}
            conteo={conteos[fila.idAgente] ?? { activos: 0, espera: 0 }}
            impreso={impreso}
          />,
        ).toBlob()
        const archivo = await directorio.getFileHandle(nombreArchivo(fila, usados), { create: true })
        const writable = await archivo.createWritable()
        await writable.write(blob)
        await writable.close()
        completados += 1
        setProgreso({ hechos: completados, total: filas.length })
        // Deja pintar el progreso antes de renderizar el siguiente PDF.
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      }

      setAviso(`Se guardaron ${completados} informe${completados === 1 ? '' : 's'} en la carpeta elegida.`)
    } catch (generationError) {
      console.error('[informe-altas] Error al generar los informes', generationError)
      const detalle =
        generationError instanceof DOMException || generationError instanceof Error
          ? generationError.name
          : 'Error desconocido'
      setError(
        completados > 0
          ? `Se guardaron ${completados} de ${filas.length} informes. No se pudo completar el resto (${detalle}).`
          : `No se pudieron generar los informes (${detalle}). Revisá la consola para más detalles.`,
      )
    } finally {
      setGenerando(false)
      setProgreso(null)
      setFase(null)
    }
  }

  const deshabilitado = filas.length === 0 || generando || loading

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void generar()}
        disabled={deshabilitado}
        className="flex items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {generando && progreso
          ? `Generando ${progreso.hechos}/${progreso.total}...`
          : `Generar informes (${filas.length})`}
      </button>
      <p className="text-[10px] text-slate-400">
        {fase ?? (generando ? 'Un PDF por persona en la carpeta elegida.' : 'Elegí una carpeta y se guardará un PDF por persona.')}
      </p>
      {generando && progreso && (
        <div className="h-1.5 w-52 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#1e3a8a] transition-all"
            style={{ width: `${progreso.total > 0 ? (progreso.hechos / progreso.total) * 100 : 0}%` }}
          />
        </div>
      )}
      {error && (
        <p className="max-w-[320px] rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-right text-[10px] font-semibold text-rose-700">
          {error}
        </p>
      )}
      {aviso && <p className="max-w-[320px] text-right text-[10px] font-semibold text-emerald-700">{aviso}</p>}
    </div>
  )
}
