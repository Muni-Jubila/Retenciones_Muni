'use client'

import { TextField } from '@/components/embargos/ui'

export function ActionCard({
  icon,
  title,
  description,
  children,
  tone = 'blue',
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'slate' | 'rose'
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-[#1e3a8a]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone]
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${tones}`}>{icon}</div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">{children}</div>
    </div>
  )
}

export function PeriodPicker({
  value,
  onChange,
  label = 'Período',
  hint = 'Formato aaaa-mm. Por defecto, mes actual.',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  hint?: string
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      type="month"
      hint={hint}
    />
  )
}
