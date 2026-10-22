'use client'

import { useState } from 'react'
import { Archive, FileSearch, FolderCog, Scale, UserRoundSearch } from 'lucide-react'
import FichaAgente from '@/components/embargos/ficha-agente'
import ConsultasEmbargos from '@/components/embargos/consultas-embargos'
import ActualizarEmbargos from '@/components/embargos/actualizar-embargos'
import ArchivosEmbargos from '@/components/embargos/archivos-embargos'

type TabEmbargos = 'ficha' | 'consultas' | 'actualizar' | 'archivos'

const TABS: { id: TabEmbargos; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: 'ficha', label: 'Ficha del agente', sublabel: 'Carga integral', icon: UserRoundSearch },
  { id: 'consultas', label: 'Consultas', sublabel: 'Por agente, expediente y más', icon: FileSearch },
  { id: 'actualizar', label: 'Actualizar', sublabel: 'Esperas, imputación y archivos', icon: FolderCog },
  { id: 'archivos', label: 'Archivos', sublabel: 'Indexar, restaurar y backup', icon: Archive },
]

interface GestionEmbargosProps {
  initialAgentId?: number | null
  onInitialConsumed?: () => void
}

export default function GestionEmbargos({ initialAgentId, onInitialConsumed }: GestionEmbargosProps) {
  const [activeTab, setActiveTab] = useState<TabEmbargos>('ficha')
  const [agenteParaAbrir, setAgenteParaAbrir] = useState<number | null>(null)
  const [tabsMontadas, setTabsMontadas] = useState<Set<TabEmbargos>>(() => new Set(['ficha']))

  const abrirTab = (tab: TabEmbargos) => {
    setActiveTab(tab)
    setTabsMontadas((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }

  const abrirFicha = (agenteId: number) => {
    setAgenteParaAbrir(agenteId)
    abrirTab('ficha')
  }

  return (
    <div className="min-h-full">
      {/* Encabezado del módulo */}
      <div className="border-b border-slate-200 bg-white px-6 pt-4 print:border-0 print:px-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a8a] text-white shadow-sm">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#1e3a8a]">Gestión de Embargos</h1>
              <p className="text-[11px] text-slate-500">
                Subsecretaría de Capital Humano · Área Retenciones · Consulta y actualización en una sola pantalla
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500 md:flex print:hidden">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Estados: <strong className="text-amber-700">E</strong> espera ·
            <strong className="text-emerald-700">A</strong> activo ·
            <strong className="text-rose-700">B</strong> baja ·
            <strong className="text-slate-600">C</strong> cancelado
          </div>
        </div>

        {/* Pestañas internas del módulo */}
        <nav className="mt-4 flex gap-1 overflow-x-auto print:hidden" aria-label="Secciones de embargos">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => abrirTab(tab.id)}
                className={`group relative flex min-w-[150px] items-center gap-2 rounded-t-lg border-b-2 px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-[#1e3a8a] bg-blue-50/70 text-[#1e3a8a]'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
                aria-selected={active}
                role="tab"
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#1e3a8a]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-tight">{tab.label}</span>
                  <span className="block truncate text-[9px] font-medium text-slate-400">{tab.sublabel}</span>
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="p-6 print:p-0">
        <div className={activeTab === 'ficha' ? 'block' : 'hidden'}>
          <FichaAgente
            initialAgenteId={agenteParaAbrir ?? initialAgentId ?? null}
            onInitialConsumed={() => {
              setAgenteParaAbrir(null)
              onInitialConsumed?.()
            }}
          />
        </div>
        {tabsMontadas.has('consultas') && (
          <div className={activeTab === 'consultas' ? 'block' : 'hidden'}>
            <ConsultasEmbargos onOpenAgent={abrirFicha} />
          </div>
        )}
        {tabsMontadas.has('actualizar') && (
          <div className={activeTab === 'actualizar' ? 'block' : 'hidden'}>
            <ActualizarEmbargos />
          </div>
        )}
        {tabsMontadas.has('archivos') && (
          <div className={activeTab === 'archivos' ? 'block' : 'hidden'}>
            <ArchivosEmbargos />
          </div>
        )}
      </div>
    </div>
  )
}
