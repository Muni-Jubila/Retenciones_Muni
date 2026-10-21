'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCuil, formatDate, formatDigitsOnly, formatLettersOnly, getDateValidationError } from '@/lib/format-utils'

interface FieldProps {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
  mask?: 'date' | 'cuil' | 'letters' | 'digits'
  error?: string | null
  forceTouched?: boolean
}

export function FormField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  mask,
  error,
  forceTouched = false,
}: FieldProps) {
  const [touched, setTouched] = useState(false)

  const isTouched = forceTouched || touched
  const dateError = error ?? (mask === 'date' ? getDateValidationError(value, isTouched) : null)

  const handleChange = (rawValue: string) => {
    if (!onChange) return
    if (mask === 'date') onChange(formatDate(rawValue))
    else if (mask === 'cuil') onChange(formatCuil(rawValue))
    else if (mask === 'letters') onChange(formatLettersOnly(rawValue))
    else if (mask === 'digits') onChange(formatDigitsOnly(rawValue))
    else onChange(rawValue)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-1">
        <label
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider truncate',
            dateError ? 'text-rose-600 font-bold' : 'text-slate-500'
          )}
        >
          {label}
        </label>
        {dateError && (
          <span className="text-[10px] text-rose-600 font-bold truncate flex items-center gap-1" title={dateError}>
            <AlertCircle className="w-3 h-3 flex-shrink-0 text-rose-600" />
            {dateError}
          </span>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setTouched(true)}
        readOnly={readOnly}
        placeholder={placeholder ?? '—'}
        title={dateError ?? undefined}
        autoComplete="off"
        className={cn(
          'rounded-md border bg-white px-2.5 py-1.5 text-sm transition',
          dateError
            ? 'border-rose-500 bg-rose-50/40 text-rose-900 placeholder:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-600'
            : 'border-slate-200 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a]',
          readOnly && 'bg-slate-50 text-slate-500 cursor-default'
        )}
      />
    </div>
  )
}

interface SectionCardProps {
  title: string
  children: React.ReactNode
  className?: string
  headerClassName?: string
}

export function SectionCard({ title, children, className, headerClassName }: SectionCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm', className)}>
      <div className={cn('px-4 py-2.5 bg-slate-50 border-b border-slate-200', headerClassName)}>
        <h3 className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
