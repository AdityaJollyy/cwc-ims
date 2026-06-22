import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router'
import { categoryApi } from '../../../api/categoryApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import DataTable from '../../../components/ui/DataTable'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Badge from '../../../components/ui/Badge'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { PageLoader } from '../../../components/ui/Loader'
import { useToast } from '../../../store/ToastContext'
import useDisclosure from '../../../hooks/useDisclosure'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown (Select)' },
]

const fieldSchema = z.object({
  field_name: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores only'),
  field_label: z.string().min(1, 'Label is required'),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  field_options: z.string().optional(),
  is_required: z.boolean().default(false),
  sort_order: z.coerce.number().default(0),
})

const FIELD_TYPE_LABELS = { text: 'Text', number: 'Number', date: 'Date', boolean: 'Yes/No', select: 'Select' }

const CategoryFieldsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const addModal = useDisclosure()
  const editModal = useDisclosure()
  const deleteDialog = useDisclosure()
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: category, isLoading: catLoading } = useQuery({
    queryKey: ['category', id],
    queryFn: () => categoryApi.getById(id).then(r => r.data.data),
  })

  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['category-fields', id],
    queryFn: () => categoryApi.getFields(id).then(r => r.data.data),
  })

  const { register: regAdd, handleSubmit: handleAdd, reset: resetAdd, watch: watchAdd, formState: { errors: errAdd, isSubmitting: subAdd } } = useForm({
    resolver: zodResolver(fieldSchema),
    defaultValues: { field_type: 'text', is_required: false, sort_order: 0 },
  })

  const { register: regEdit, handleSubmit: handleEditForm, reset: resetEdit, watch: watchEdit, formState: { errors: errEdit, isSubmitting: subEdit } } = useForm({ resolver: zodResolver(fieldSchema) })

  const addMutation = useMutation({
    mutationFn: (d) => categoryApi.addField(id, d),
    onSuccess: () => { toast.success('Field added'); queryClient.invalidateQueries({ queryKey: ['category-fields', id] }); addModal.close(); resetAdd() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add field'),
  })

  const updateMutation = useMutation({
    mutationFn: (d) => categoryApi.updateField(id, editTarget.id, d),
    onSuccess: () => { toast.success('Field updated'); queryClient.invalidateQueries({ queryKey: ['category-fields', id] }); editModal.close() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => categoryApi.deleteField(id, deleteTarget.id),
    onSuccess: () => { toast.success('Field deleted'); queryClient.invalidateQueries({ queryKey: ['category-fields', id] }); deleteDialog.close() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete'),
  })

  const handleEditOpen = (field) => {
    setEditTarget(field)
    resetEdit({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: Array.isArray(field.field_options) ? field.field_options.join(', ') : '',
      is_required: field.is_required,
      sort_order: field.sort_order,
    })
    editModal.open()
  }

  const prepareData = (d) => ({
    ...d,
    field_options: d.field_type === 'select' && d.field_options
      ? d.field_options.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
  })

  const columns = [
    { key: 'field_name', header: 'Field Key', render: (v) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{v}</code> },
    { key: 'field_label', header: 'Label', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'field_type', header: 'Type', render: (v) => FIELD_TYPE_LABELS[v] || v },
    { key: 'is_required', header: 'Required', render: (v) => v ? <Badge status="active" label="Required" size="sm" /> : <span className="text-slate-400 text-xs">Optional</span> },
    {
      key: 'field_options', header: 'Options',
      render: (v) => Array.isArray(v) && v.length ? <span className="text-xs text-slate-500">{v.join(', ')}</span> : '—'
    },
    {
      key: 'actions', header: '', width: '100px',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); handleEditOpen(row) }}>Edit</Button>
          <Button variant="danger-ghost" size="xs" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); deleteDialog.open() }}>Del</Button>
        </div>
      )
    },
  ]

  const FieldForm = ({ register, watch, errors, formId, onSubmit }) => {
    const fieldType = watch('field_type')
    return (
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Field Key" required error={errors.field_name?.message} placeholder="e.g. ram_size" hint="lowercase, no spaces" {...register('field_name')} />
          <Input label="Display Label" required error={errors.field_label?.message} placeholder="e.g. RAM Size" {...register('field_label')} />
        </div>
        <Select label="Field Type" options={FIELD_TYPES} {...register('field_type')} />
        {fieldType === 'select' && (
          <Input label="Options (comma-separated)" placeholder="e.g. 8GB, 16GB, 32GB" error={errors.field_options?.message} {...register('field_options')} />
        )}
        <div className="flex items-center gap-2">
          <input type="checkbox" id={`${formId}-required`} {...register('is_required')} className="accent-indigo-600 w-4 h-4" />
          <label htmlFor={`${formId}-required`} className="text-sm text-slate-700">This field is required</label>
        </div>
        <Input label="Sort Order" type="number" hint="Lower numbers appear first" {...register('sort_order')} />
      </form>
    )
  }

  if (catLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title={`${category?.name || 'Category'} — Custom Fields`}
        subtitle="Define the fields that appear when creating assets in this category"
        backButton={
          <button onClick={() => navigate('/categories')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Categories
          </button>
        }
        actions={
          <Button onClick={addModal.open} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
            Add Field
          </Button>
        }
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
        <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-sm text-amber-800">Fields defined here will automatically appear when creating assets in the <strong>{category?.name}</strong> category. No code changes required.</p>
      </div>

      <DataTable
        columns={columns}
        data={fields || []}
        isLoading={fieldsLoading}
        emptyMessage="No custom fields yet. Add fields to collect specific information for this asset type."
      />

      {/* Add Field Modal */}
      <Modal isOpen={addModal.isOpen} onClose={() => { addModal.close(); resetAdd() }} title="Add Custom Field" size="md"
        footer={<><Button variant="secondary" onClick={() => { addModal.close(); resetAdd() }}>Cancel</Button><Button form="add-field" type="submit" loading={subAdd}>Add Field</Button></>}
      >
        <FieldForm register={regAdd} watch={watchAdd} errors={errAdd} formId="add-field" onSubmit={handleAdd(d => addMutation.mutate(prepareData(d)))} />
      </Modal>

      {/* Edit Field Modal */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.close} title="Edit Field" size="md"
        footer={<><Button variant="secondary" onClick={editModal.close}>Cancel</Button><Button form="edit-field" type="submit" loading={subEdit}>Save</Button></>}
      >
        <FieldForm register={regEdit} watch={watchEdit} errors={errEdit} formId="edit-field" onSubmit={handleEditForm(d => updateMutation.mutate(prepareData(d)))} />
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete Field?"
        message={`Delete field "${deleteTarget?.field_label}"? This will remove this field from all future asset creations (existing data is not affected).`}
      />
    </div>
  )
}

export default CategoryFieldsPage
