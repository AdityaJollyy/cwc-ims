import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { employeeApi } from '../../../api/employeeApi'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'

const schema = z.object({
  employee_code: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  division: z.string().optional(),
  designation: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  remarks: z.string().optional(),
})

// Known divisions — used as a base list so the dropdown is never empty
// even before any employee data exists in the database.
export const KNOWN_DIVISIONS = [
  'VIGILANCE',
  'ENGINEERING',
  'RAIL',
  'HINDI',
  'PERSONNEL',
  'CUSTOM CELL',
  'NBP & P',
  'Server Room, Per',
  'Reception',
  'Dispatch',
  'Inspection',
  'Internal Audit',
  'MIS',
  'Commercial',
  'Finance',
  'TECHNICAL',
  'BNC',
  'MD Office',
  'DP Office',
  'DF Office',
  'Dir.M&CP Sectt',
  'Dir.M&CP AM Sectt',
]

// ─── Division Combobox ──────────────────────────────────────────
// Lets users pick from existing divisions OR type a brand-new one.
const DivisionCombobox = ({ value, onChange, error }) => {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value || '')
  const rootRef = useRef(null)

  // Fetch any extra divisions that exist in the DB beyond the known list
  const { data: dbDivisions = [] } = useQuery({
    queryKey: ['employee-divisions'],
    queryFn: () => employeeApi.getDivisions().then(r => r.data.data),
    staleTime: 60_000,
  })

  // Merge: start with known list, then append any DB value not already present
  const allDivisions = [
    ...KNOWN_DIVISIONS,
    ...dbDivisions.filter(
      d => !KNOWN_DIVISIONS.some(k => k.toLowerCase() === d.toLowerCase())
    ),
  ]

  // Sync external value changes (e.g. reset on edit)
  useEffect(() => {
    setInputVal(value || '')
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = allDivisions.filter(d =>
    d.toLowerCase().includes(inputVal.trim().toLowerCase())
  )

  const handleInput = (e) => {
    setInputVal(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  const handleSelect = (div) => {
    setInputVal(div)
    onChange(div)
    setOpen(false)
  }

  const showNew = inputVal.trim() &&
    !allDivisions.some(d => d.toLowerCase() === inputVal.trim().toLowerCase())

  // Show all options when input is empty and dropdown is open
  const listToShow = inputVal.trim() === '' ? allDivisions : filtered

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5 relative">
      <label className="text-sm font-medium text-slate-700">Division</label>
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder="Select or type a division…"
          autoComplete="off"
          className={[
            'w-full h-9 pl-3 pr-8 rounded-lg border text-sm text-slate-800 outline-none',
            'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white transition-all',
            error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
          ].join(' ')}
        />
        {/* chevron toggle */}
        <span
          onMouseDown={(e) => { e.preventDefault(); setOpen(o => !o) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer select-none"
        >
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {open && (listToShow.length > 0 || showNew) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {listToShow.map(div => (
            <button
              key={div}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(div) }}
              className={[
                'w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between',
                inputVal === div
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-slate-800 hover:bg-slate-50',
              ].join(' ')}
            >
              {div}
              {inputVal === div && (
                <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
          {showNew && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(inputVal.trim()) }}
              className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 font-medium"
            >
              + Add new: &quot;{inputVal.trim()}&quot;
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Employee Form ──────────────────────────────────────────────
const EmployeeForm = ({ formId, onSubmit, defaultValues, isEdit }) => {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {},
  })

  useEffect(() => {
    if (defaultValues) reset(defaultValues)
  }, [defaultValues, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Employee Code"
          placeholder="e.g. EMP001, A-23 (optional)"
          hint="Optional unique label assigned by admin"
          error={errors.employee_code?.message}
          {...register('employee_code')}
        />
        <Input
          label="Full Name"
          placeholder="John Doe"
          required
          error={errors.name?.message}
          {...register('name')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="division"
          control={control}
          render={({ field }) => (
            <DivisionCombobox
              value={field.value || ''}
              onChange={field.onChange}
              error={errors.division?.message}
            />
          )}
        />
        <Input
          label="Designation"
          placeholder="e.g. Software Engineer, Manager"
          error={errors.designation?.message}
          {...register('designation')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Mobile"
          placeholder="+91 98765 43210"
          type="tel"
          error={errors.mobile?.message}
          {...register('mobile')}
        />
        <Input
          label="Email"
          placeholder="john@example.com"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <Textarea
        label="Remarks"
        placeholder="Any additional notes..."
        rows={2}
        error={errors.remarks?.message}
        {...register('remarks')}
      />
    </form>
  )
}

export default EmployeeForm
