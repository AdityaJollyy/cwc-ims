import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { assetApi } from '../../../api/assetApi'
import { assignmentApi } from '../../../api/assignmentApi'
import { categoryApi } from '../../../api/categoryApi'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import Select from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Loader'
import { useToast } from '../../../store/ToastContext'

// ─── Shared styling ──────────────────────────────────────────────
const inputCls =
  'w-full h-9 pl-3 pr-3 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white'

// ─── Zod schema ───────────────────────────────────────────────────
const schema = z.object({
  // Asset fields
  category_id: z.string().min(1, 'Category is required'),
  product_name: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_number: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  asset_remarks: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
  // Assignment fields
  assigned_at: z.string().optional(),
  assignment_remarks: z.string().optional(),
})

// ─── Custom field renderer (mirrors AssetForm logic exactly) ─────
const CustomField = ({ field, register, errors, control }) => {
  const name = `custom_fields.${field.field_name}`

  if (field.field_type === 'boolean') {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">
          {field.field_label}
          {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            {...register(name)}
          />
          <span className="text-sm text-slate-600">Yes</span>
        </label>
      </div>
    )
  }

  if (field.field_type === 'select') {
    const opts = Array.isArray(field.field_options)
      ? field.field_options
      : (field.field_options || '').split(',').map((o) => o.trim()).filter(Boolean)
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <Select
            label={field.field_label}
            required={field.is_required}
            options={opts.map((o) => ({ value: o, label: o }))}
            value={f.value || ''}
            onChange={f.onChange}
            error={errors?.custom_fields?.[field.field_name]?.message}
          />
        )}
      />
    )
  }

  const typeMap = { text: 'text', number: 'number', date: 'date' }
  return (
    <Input
      label={field.field_label}
      type={typeMap[field.field_type] || 'text'}
      required={field.is_required}
      error={errors?.custom_fields?.[field.field_name]?.message}
      {...register(name)}
    />
  )
}

// ─── Section header helper ────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2 mb-1">
    {children}
  </p>
)

// ─── Main Modal ───────────────────────────────────────────────────
const MakeAndAssignAssetModal = ({ isOpen, onClose, employee, onSuccess }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [categoryId, setCategoryId] = useState('')

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {},
  })

  // Categories list
  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAll().then((r) => r.data.data),
    enabled: isOpen,
  })

  // Custom fields for selected category
  const { data: customFields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['category-fields', categoryId],
    queryFn: () => categoryApi.getFields(categoryId).then((r) => r.data.data),
    enabled: !!categoryId && isOpen,
  })

  const categoryOptions = (categories || []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }))

  const handleClose = () => {
    reset()
    setCategoryId('')
    onClose()
  }

  const onSubmit = async (data) => {
    setSubmitting(true)
    try {
      // Step 1 — create the asset
      const assetPayload = {
        category_id: data.category_id,
        product_name: data.product_name || undefined,
        model: data.model || undefined,
        serial_number: data.serial_number || undefined,
        asset_number: data.asset_number || undefined,
        purchase_date: data.purchase_date || undefined,
        warranty_expiry: data.warranty_expiry || undefined,
        remarks: data.asset_remarks || undefined,
        custom_fields: data.custom_fields || undefined,
      }
      const assetRes = await assetApi.create(assetPayload)
      const newAsset = assetRes.data.data

      // Step 2 — assign the newly created asset to this employee
      await assignmentApi.assign({
        employee_id: employee.id,
        asset_id: newAsset.id,
        assigned_at: data.assigned_at || undefined,
        remarks: data.assignment_remarks || undefined,
      })

      toast.success(`Asset created and assigned to ${employee.name}`)

      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets-available'] })
      queryClient.invalidateQueries({ queryKey: ['assignments-active'] })
      queryClient.invalidateQueries({ queryKey: ['assignments-history'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-assignments', employee.id] })
      queryClient.invalidateQueries({ queryKey: ['employee-history', employee.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      onSuccess?.()
      handleClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create & Assign Asset"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            form="make-assign-form"
            type="submit"
            loading={submitting}
          >
            Create &amp; Assign
          </Button>
        </>
      }
    >
      {/* Employee context banner */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {employee?.name?.[0]?.toUpperCase() || 'E'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{employee?.name}</p>
          <p className="text-xs text-slate-500">
            {[employee?.designation, employee?.division].filter(Boolean).join(' · ') || 'Employee'}
          </p>
        </div>
        <span className="ml-auto text-xs text-indigo-600 font-medium bg-white px-2 py-1 rounded-lg border border-indigo-200 shrink-0">
          Asset will be assigned to this employee
        </span>
      </div>

      <form id="make-assign-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* ── Asset Details ─────────────────────────────────────── */}
        <SectionLabel>Asset Details</SectionLabel>

        {/* Category */}
        <Controller
          name="category_id"
          control={control}
          render={({ field }) => (
            <Select
              label="Category"
              required
              options={categoryOptions}
              value={field.value || ''}
              onChange={(e) => {
                field.onChange(e)
                setCategoryId(e.target.value)
              }}
              error={errors.category_id?.message}
              placeholder={catsLoading ? 'Loading...' : 'Select category'}
            />
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Product Name"
            placeholder="e.g. Dell Latitude 5540"
            error={errors.product_name?.message}
            {...register('product_name')}
          />
          <Input
            label="Model"
            placeholder="e.g. Latitude 5540"
            error={errors.model?.message}
            {...register('model')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Serial Number"
            placeholder="e.g. SN123456789"
            error={errors.serial_number?.message}
            {...register('serial_number')}
          />
          <Input
            label="Asset Number"
            placeholder="Internal asset tag"
            error={errors.asset_number?.message}
            {...register('asset_number')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Purchase Date"
            type="date"
            error={errors.purchase_date?.message}
            {...register('purchase_date')}
          />
          <Input
            label="Warranty Expiry"
            type="date"
            error={errors.warranty_expiry?.message}
            {...register('warranty_expiry')}
          />
        </div>

        {/* Custom fields for selected category */}
        {categoryId && (
          <div>
            {fieldsLoading ? (
              <div className="flex items-center gap-2 py-2 text-slate-500 text-sm">
                <Spinner size="sm" />
                Loading category fields…
              </div>
            ) : customFields && customFields.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {categories?.find((c) => String(c.id) === String(categoryId))?.name} Fields
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customFields.map((f) => (
                    <CustomField
                      key={f.id}
                      field={f}
                      register={register}
                      errors={errors}
                      control={control}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <Textarea
          label="Asset Remarks"
          placeholder="Any notes about the asset..."
          rows={2}
          error={errors.asset_remarks?.message}
          {...register('asset_remarks')}
        />

        {/* ── Assignment Details ────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4">
          <SectionLabel>Assignment Details</SectionLabel>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Assignment Date{' '}
            <span className="text-slate-400 text-xs">(defaults to today)</span>
          </label>
          <input
            type="date"
            className={inputCls}
            {...register('assigned_at')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Assignment Remarks{' '}
            <span className="text-slate-400 text-xs">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Issued for WFH setup, replacing old unit..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none bg-white"
            {...register('assignment_remarks')}
          />
        </div>

        <p className="text-xs text-slate-500 bg-blue-50 px-3 py-2 rounded-lg">
          💡 The asset will be created with status <strong>Available</strong>, then immediately assigned to{' '}
          <strong>{employee?.name}</strong> — appearing as <strong>Assigned</strong> in the assets list.
        </p>
      </form>
    </Modal>
  )
}

export default MakeAndAssignAssetModal
