'use client'

import { FileText, LayoutDashboard, Scale, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NavSection = 'inicio' | 'embargos' | 'informes' | 'usuarios'

interface SidebarProps {
  activeSection: NavSection
  onSectionChange: (section: NavSection) => void
  role: string
}

export default function Sidebar({ activeSection, onSectionChange, role }: SidebarProps) {
  const isAdmin = role === 'ADMIN'

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-[#172554] text-slate-200 flex-shrink-0">
      {/* Brand */}
      <div className="flex h-[100px] flex-shrink-0 flex-col items-center justify-center px-3 bg-white border-b border-slate-200">
        <span className="text-lg font-black uppercase tracking-[0.25em] text-[#1e3a8a]">
          Retenciones
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
          Municipalidad de Córdoba
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 pt-4">
        {/* INICIO */}
        <button
          onClick={() => onSectionChange('inicio')}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
            activeSection === 'inicio'
              ? 'bg-[#1d4ed8] text-white'
              : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span>INICIO</span>
        </button>

        {/* EMBARGOS / RETENCIONES */}
        <button
          onClick={() => onSectionChange('embargos')}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
            activeSection === 'embargos'
              ? 'bg-[#1d4ed8] text-white'
              : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
          )}
        >
          <Scale className="w-4 h-4 flex-shrink-0" />
          <span>EMBARGOS</span>
        </button>

        {/* INFORMES */}
        <button
          onClick={() => onSectionChange('informes')}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
            activeSection === 'informes'
              ? 'bg-[#1d4ed8] text-white'
              : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
          )}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>INFORMES</span>
        </button>

        {/* GESTIÓN DE USUARIOS (solo ADMIN) */}
        {isAdmin && (
          <button
            onClick={() => onSectionChange('usuarios')}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
              activeSection === 'usuarios'
                ? 'bg-[#1d4ed8] text-white'
                : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
            )}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>GESTIÓN DE USUARIOS</span>
          </button>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1 pt-4" />

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-[#1e3a8a]">
        <p className="text-[10px] text-blue-500 text-center">v0.1.0 · RRHH Retenciones</p>
      </div>
    </aside>
  )
}
