import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { categoryApi } from '../../../api/categoryApi'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import Select from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Loader'

const schema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  product_name: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_number: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  remarks: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
})

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
          <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" {...register(name)} />
          <span className="text-sm text-slate-600">Yes</span>
        </label>
      </div>
    )
  }

  if (field.field_type === 'select') {
    const opts = Array.isArray(field.field_options)
      ? field.field_options
      : (field.field_options || '').split(',').map(o => o.trim()).filter(Boolean)
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <Select
            label={field.field_label}
            required={field.is_required}
            options={opts.map(o => ({ value: o, label: o }))}
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

const AssetForm = ({ formId, onSubmit, defaultValues, isEdit }) => {
  const [categoryId, setCategoryId] = useState(defaultValues?.category_id || '')

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAll().then(r => r.data.data),
  })

  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['category-fields', categoryId],
    queryFn: () => categoryApi.getFields(categoryId).then(r => r.data.data),
    enabled: !!categoryId,
  })

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {},
  })

  useEffect(() => {
    if (defaultValues) reset(defaultValues)
  }, [defaultValues, reset])

  const categoryOptions = (categories || []).map(c => ({
    value: String(c.id),
    label: c.name,
  }))

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Category — required */}
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

      {/* Custom Fields for selected category */}
      {categoryId && (
        <div>
          {fieldsLoading ? (
            <div className="flex items-center gap-2 py-2 text-slate-500 text-sm">
              <Spinner size="sm" />
              Loading category fields...
            </div>
          ) : fields && fields.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {categories?.find(c => String(c.id) === String(categoryId))?.name} Fields
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map((f) => (
                  <CustomField key={f.id} field={f} register={register} errors={errors} control={control} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

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

export default AssetForm
