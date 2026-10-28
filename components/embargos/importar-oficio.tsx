'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileUp,
  Loader2,
  Search,
  Upload,
  UserRoundSearch,
  X,
} from 'lucide-react'
import { analizarOficioJudicial, type AnalizarOficioResult } from '@/app/actions/oficios'
import { formatMoney } from '@/lib/embargos'
import type { DatosOficio } from '@/lib/oficio-parser'
import type { Empleado } from '@/lib/empleados'
import { Banner } from '@/components/embargos/ui'

export interface ArchivoOficio {
  nombre: string
  url: string
}

interface ImportarOficioProps {
  onImport: (agente: Empleado, datos: DatosOficio, archivo: ArchivoOficio) => void
  onBuscarAgente: (datos: DatosOficio, archivo: ArchivoOficio, dni?: string) => void
  /** Se invoca cuando el operador quita el PDF para liberar la referencia en el formulario. */
  onQuitar?: () => void
}

const MAX_FILE_BYTES = 6 * 1024 * 1024

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

function DatoOficio({
  label,
  value,
  mono = false,
  full = false,
  missing = false,
}: {
  label: string
  value: string
  mono?: boolean
  full?: boolean
  missing?: boolean
}) {
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`mt-0.5 break-words text-xs font-semibold ${
          missing ? 'text-amber-700' : 'text-slate-700'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value || 'No detectado'}
      </p>
    </div>
  )
}

export default function ImportarOficio({ onImport, onBuscarAgente, onQuitar }: ImportarOficioProps) {
  const [archivo, setArchivo] = useState<ArchivoOficio | null>(null)
  const [tamano, setTamano] = useState(0)
  const [resultado, setResultado] = useState<AnalizarOficioResult | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (archivo?.url) URL.revokeObjectURL(archivo.url)
    }
  }, [archivo?.url])

  const limpiar = () => {
    if (archivo?.url) URL.revokeObjectURL(archivo.url)
    setArchivo(null)
    setTamano(0)
    setResultado(null)
    setError(null)
    setAnalizando(false)
    if (inputRef.current) inputRef.current.value = ''
    onQuitar?.()
  }

  const procesar = async (file: File | null) => {
    if (!file) return

    const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!esPdf) {
      setError('El archivo debe ser un PDF.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`El PDF supera el tamaño máximo de ${formatBytes(MAX_FILE_BYTES)}.`)
      return
    }

    if (archivo?.url) URL.revokeObjectURL(archivo.url)
    const url = URL.createObjectURL(file)
    setArchivo({ nombre: file.name, url })
    setTamano(file.size)
    setResultado(null)
    setError(null)
    setAnalizando(true)

    try {
      const dataUrl = await readFileAsDataUrl(file)
      const respuesta = await analizarOficioJudicial({
        nombreArchivo: file.name,
        contenidoBase64: dataUrl,
      })
      if (!respuesta.ok) {
        setError(respuesta.error ?? 'No se pudo analizar el oficio judicial.')
        return
      }
      setResultado(respuesta)
    } catch {
      setError('No se pudo leer o analizar el PDF. Verificá que el archivo no esté dañado.')
    } finally {
      setAnalizando(false)
    }
  }

  const datos = resultado?.datos ?? null
  const agente = resultado?.agente ?? null
  const advertencias = resultado?.advertencias ?? []

  const importar = () => {
    if (!datos || !agente || !archivo) return
    onImport(agente, datos, archivo)
  }

  const buscar = () => {
    if (!datos || !archivo) return
    onBuscarAgente(datos, archivo, datos.dni || undefined)
  }

  if (!archivo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <FileUp className="h-4 w-4 text-[#1e3a8a]" />
              Cargar oficio judicial en PDF
            </h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-500">
              Arrastrá o seleccioná un oficio. El sistema lee el DNI, busca al agente y completa autos, expediente
              judicial, monto, cuenta y sucursal. Después podés revisar el PDF y corregir los datos antes de guardar.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1e3a8a]">
            Lectura automática
          </span>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(event) => {
            event.preventDefault()
            setArrastrando(false)
            void procesar(event.dataTransfer.files?.[0] ?? null)
          }}
          className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
            arrastrando ? 'border-[#1e3a8a] bg-blue-50' : 'border-slate-300 bg-slate-50/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => void procesar(event.target.files?.[0] ?? null)}
          />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#1e3a8a]">
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">
            Arrastrá el PDF acá o{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-bold text-[#1e3a8a] underline decoration-blue-300 underline-offset-2 hover:text-[#172554]"
            >
              seleccioná un archivo
            </button>
          </p>
          <p className="text-[10px] text-slate-400">PDF con texto seleccionable · máximo {formatBytes(MAX_FILE_BYTES)}</p>
        </div>

        {error && (
          <div className="mt-3">
            <Banner tone="error" onClose={() => setError(null)}>
              {error}
            </Banner>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-[#1e3a8a]" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-800">{archivo.nombre}</p>
            <p className="text-[10px] text-slate-400">{formatBytes(tamano)} · Vista previa del oficio judicial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={archivo.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir PDF
          </a>
          <button
            type="button"
            onClick={limpiar}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <X className="h-3 w-3" />
            Quitar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <iframe
            src={archivo.url}
            title={`Vista previa de ${archivo.nombre}`}
            className="h-[420px] w-full rounded-lg border border-slate-200 bg-slate-100 lg:h-[560px]"
          />
        </div>

        <div className="space-y-3 lg:col-span-5">
          {analizando && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs font-semibold text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Leyendo el oficio y buscando el agente...
            </div>
          )}

          {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}

          {datos && (
            <>
              {agente ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Agente encontrado</p>
                      <p className="truncate text-sm font-bold text-slate-800">{agente.nombreCompleto}</p>
                      <p className="text-[10px] text-slate-600">
                        DNI {agente.dni || '—'} · CUIL {agente.cuil || '—'}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {agente.programa || 'Sin programa'} · {agente.cargo || 'Sin cargo'} ·{' '}
                        {agente.estadoActivo ? 'Activo' : 'Inactivo'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={importar}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <UserRoundSearch className="h-3.5 w-3.5" />
                    Cargar embargo con estos datos
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        {datos.dni ? 'Agente no encontrado' : 'DNI no detectado'}
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        {datos.dni
                          ? `No hay un agente con DNI ${datos.dni} en la base. Podés buscarlo manualmente y aplicar los datos del oficio al agente que selecciones.`
                          : 'No se pudo leer el DNI del oficio. Buscá al agente manualmente; los datos detectados se aplicarán al agente que selecciones.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={buscar}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#172554]"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {datos.dni ? 'Buscar agente por DNI' : 'Buscar agente manualmente'}
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a]">
                  <FileText className="h-3 w-3" />
                  Datos detectados en el oficio
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <DatoOficio label="Expediente Judicial N°" value={datos.expediente} mono missing={!datos.expediente} />
                  <DatoOficio label="Expediente Retenciones N°" value="Se asigna al guardar" />
                  <DatoOficio label="DNI" value={datos.dni} mono missing={!datos.dni} />
                  <DatoOficio label="CUIL" value={datos.cuil || agente?.cuil || ''} mono missing={!(datos.cuil || agente?.cuil)} />
                  <DatoOficio
                    label="Monto del embargo"
                    value={datos.monto > 0 ? formatMoney(datos.monto) : ''}
                    mono
                    missing={!datos.monto}
                  />
                  <DatoOficio label="Sucursal" value={datos.sucursal} missing={!datos.sucursal} />
                  <DatoOficio label="Cuenta N°" value={datos.cuenta} mono missing={!datos.cuenta} />
                  <DatoOficio label="Fecha" value={datos.fechaExpediente} mono missing={!datos.fechaExpediente} />
                  <DatoOficio label="N° de oficio (referencia)" value={datos.numeroOficio} mono />
                  <DatoOficio label="Juzgado" value={datos.juez} full missing={!datos.juez} />
                  <DatoOficio label="Secretaría" value={datos.secretaria} />
                  <DatoOficio label="Autos" value={datos.autos} full missing={!datos.autos} />
                </div>
              </div>

              {advertencias.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    <AlertCircle className="h-3 w-3" />
                    Revisar antes de guardar
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-amber-800">
                    {advertencias.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
