import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assignmentApi } from '../../../api/assignmentApi'
import { employeeApi } from '../../../api/employeeApi'
import { assetApi } from '../../../api/assetApi'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../store/ToastContext'

const schema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  asset_id: z.string().min(1, 'Asset is required'),
  serial_number: z.string().optional(),
  asset_number: z.string().optional(),
  remarks: z.string().optional(),
})

const SearchableSelect = ({ label, placeholder, options, value, onChange, error, loading }) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.sublabel?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20)

  const selected = options.find(o => o.value === value)

  return (
    <div className="flex flex-col gap-1.5 relative">
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}<span className="text-red-500 ml-0.5">*</span>
        </label>
      )}
      <div
        className={[
          'flex items-center h-9 rounded-lg border px-3 bg-white cursor-pointer',
          'transition-all duration-150',
          open ? 'ring-2 ring-indigo-500/20 border-indigo-400' : 'border-slate-200 hover:border-slate-300',
          error ? 'border-red-400' : '',
        ].join(' ')}
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <div className="flex-1 min-w-0">
            <span className="text-sm text-slate-800 font-medium">{selected.label}</span>
            {selected.sublabel && <span className="text-xs text-slate-400 ml-2">{selected.sublabel}</span>}
          </div>
        ) : (
          <span className="text-sm text-slate-400 flex-1">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              placeholder={`Search ${label?.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full text-sm px-2 py-1.5 outline-none text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="py-4 text-center text-sm text-slate-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-400">No results</div>
            ) : filtered.map(opt => (
              <div
                key={opt.value}
                className={[
                  'flex flex-col px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors',
                  opt.value === value ? 'bg-indigo-50' : '',
                ].join(' ')}
                onClick={() => { onChange(opt.value); setOpen(false); setSearch('') }}
              >
                <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                {opt.sublabel && <span className="text-xs text-slate-400">{opt.sublabel}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const AssignAssetModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  const { data: employeesData, isLoading: empsLoading } = useQuery({
    queryKey: ['employees', { status: 'active', limit: 500 }],
    queryFn: () => employeeApi.getAll({ status: 'active', limit: 500 }).then(r => r.data.data),
    enabled: isOpen,
  })

  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', { status: 'available', limit: 500 }],
    queryFn: () => assetApi.getAll({ status: 'available', limit: 500 }).then(r => r.data.data),
    enabled: isOpen,
  })

  const assignMutation = useMutation({
    mutationFn: (data) => assignmentApi.assign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      reset()
      onClose()
      toast.success('Asset assigned successfully')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign asset'),
  })

  const employeeOptions = (employeesData?.employees || []).map(e => ({
    value: String(e.id),
    label: e.name,
    sublabel: [e.employee_code, e.division].filter(Boolean).join(' · '),
  }))

  const assetOptions = (assetsData?.assets || []).map(a => ({
    value: String(a.id),
    label: a.product_name || `Asset #${a.id}`,
    sublabel: [a.category_name, a.model, a.serial_number].filter(Boolean).join(' · '),
  }))

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Assign Asset"
      size="md"
    >
      <form onSubmit={handleSubmit((d) => assignMutation.mutate(d))} className="flex flex-col gap-4">
        <Controller
          name="employee_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="Employee"
              placeholder="Select employee..."
              options={employeeOptions}
              value={field.value || ''}
              onChange={field.onChange}
              error={errors.employee_id?.message}
              loading={empsLoading}
            />
          )}
        />

        <Controller
          name="asset_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="Asset"
              placeholder="Select available asset..."
              options={assetOptions}
              value={field.value || ''}
              onChange={field.onChange}
              error={errors.asset_id?.message}
              loading={assetsLoading}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Serial Number"
            placeholder="Update serial no. (optional)"
            error={errors.serial_number?.message}
            {...register('serial_number')}
          />
          <Input
            label="Asset Number"
            placeholder="Update asset no. (optional)"
            error={errors.asset_number?.message}
            {...register('asset_number')}
          />
        </div>

        <Textarea
          label="Remarks"
          placeholder="Any notes for this assignment..."
          rows={2}
          error={errors.remarks?.message}
          {...register('remarks')}
        />

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={assignMutation.isPending}>
            Assign Asset
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AssignAssetModal
