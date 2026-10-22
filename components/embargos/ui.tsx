'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, getEstadoConfig } from '@/lib/embargos'

export function EstadoBadge({ estado, compact = false }: { estado: string; compact?: boolean }) {
  const config = getEstadoConfig(estado)
  return (
    <span
      title={config.descripcion}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        config.badgeClass,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClass)} />
      {compact ? config.letra : config.label}
    </span>
  )
}

export function Money({ value, className, symbol = true }: { value: number; className?: string; symbol?: boolean }) {
  return <span className={cn('font-mono tabular-nums', className)}>{formatMoney(value, symbol)}</span>
}

export function Banner({
  tone = 'error',
  children,
  onClose,
}: {
  tone?: 'error' | 'success' | 'info' | 'warning'
  children: ReactNode
  onClose?: () => void
}) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }[tone]
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle

  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs', styles)}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 transition hover:opacity-100" aria-label="Cerrar">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1e3a8a]">{icon}</div>
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  children?: ReactNode
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
              danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-[#1e3a8a]',
            )}
          >
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <div className="mt-1 text-xs leading-relaxed text-slate-500">{description}</div>
            {children}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-60',
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#1e3a8a] hover:bg-[#172554]',
            )}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  className,
  required,
  error,
  maxLength,
  readOnly,
  type = 'text',
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
  error?: string | null
  maxLength?: number
  readOnly?: boolean
  type?: string
  hint?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? '—'}
        maxLength={maxLength}
        readOnly={readOnly}
        autoComplete="off"
        className={cn(
          'rounded-md border px-2.5 py-1.5 text-sm transition',
          error
            ? 'border-rose-500 bg-rose-50/40 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-200'
            : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200',
          readOnly && 'cursor-default bg-slate-50 text-slate-500',
        )}
      />
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      {error && <span className="text-[10px] font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
  disabled,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 transition focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </label>
  )
}

export function MoneyField({
  label,
  value,
  onChange,
  placeholder,
  className,
  error,
  hint,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  error?: string | null
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? '0,00'}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'w-full rounded-md border py-1.5 pl-6 pr-2.5 text-right font-mono text-sm tabular-nums transition',
            error
              ? 'border-rose-500 bg-rose-50/40 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-200'
              : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-blue-200',
            disabled && 'cursor-default bg-slate-50 text-slate-500',
          )}
        />
      </div>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      {error && <span className="text-[10px] font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-700">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  )
}
