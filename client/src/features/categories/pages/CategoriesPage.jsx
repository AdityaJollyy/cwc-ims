import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { categoryApi } from '../../../api/categoryApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import EmptyState from '../../../components/ui/EmptyState'
import { PageLoader } from '../../../components/ui/Loader'
import { useToast } from '../../../store/ToastContext'
import useDisclosure from '../../../hooks/useDisclosure'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

const CategoryCard = ({ category, onEdit, onDelete, onManageFields }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all duration-150 group">
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="xs" onClick={() => onEdit(category)}>Edit</Button>
        <Button variant="danger-ghost" size="xs" onClick={() => onDelete(category)}>Delete</Button>
      </div>
    </div>

    <h3 className="font-semibold text-slate-800 mb-1">{category.name}</h3>
    {category.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{category.description}</p>}

    <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-100">
      <Button variant="secondary" size="xs" onClick={() => onManageFields(category)}>
        Manage Fields →
      </Button>
    </div>
  </div>
)

const CategoriesPage = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createModal = useDisclosure()
  const editModal = useDisclosure()
  const deleteDialog = useDisclosure()
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAll().then(r => r.data.data),
  })

  const { register: regCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errCreate, isSubmitting: subCreate } } = useForm({ resolver: zodResolver(categorySchema) })
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errEdit, isSubmitting: subEdit } } = useForm({ resolver: zodResolver(categorySchema) })

  const createMutation = useMutation({
    mutationFn: (d) => categoryApi.create(d),
    onSuccess: () => { toast.success('Category created'); queryClient.invalidateQueries({ queryKey: ['categories'] }); createModal.close(); resetCreate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (d) => categoryApi.update(editTarget.id, d),
    onSuccess: () => { toast.success('Category updated'); queryClient.invalidateQueries({ queryKey: ['categories'] }); editModal.close() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => categoryApi.delete(deleteTarget.id),
    onSuccess: () => { toast.success('Category deleted'); queryClient.invalidateQueries({ queryKey: ['categories'] }); deleteDialog.close() },
    onError: (err) => toast.error(err.response?.data?.message || 'Cannot delete — assets exist in this category'),
  })

  const handleEditOpen = (cat) => {
    setEditTarget(cat)
    resetEdit({ name: cat.name, description: cat.description || '' })
    editModal.open()
  }

  const handleDeleteOpen = (cat) => {
    setDeleteTarget(cat)
    deleteDialog.open()
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Manage asset categories and their custom fields"
        actions={
          <Button onClick={createModal.open} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
            Add Category
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 skeleton rounded-xl" />)}
        </div>
      ) : !categories?.length ? (
        <EmptyState
          title="No categories yet"
          message="Create categories like Desktop, Laptop, Printer to start managing assets"
          action={<Button onClick={createModal.open}>Add First Category</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map(cat => (
            <CategoryCard
              key={cat.id}
              category={cat}
              onEdit={handleEditOpen}
              onDelete={handleDeleteOpen}
              onManageFields={(c) => navigate(`/categories/${c.id}/fields`)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onClose={() => { createModal.close(); resetCreate() }} title="Add Category" size="sm"
        footer={<><Button variant="secondary" onClick={() => { createModal.close(); resetCreate() }}>Cancel</Button><Button form="create-cat" type="submit" loading={subCreate}>Create</Button></>}
      >
        <form id="create-cat" onSubmit={handleCreate(d => createMutation.mutate(d))} className="flex flex-col gap-4">
          <Input label="Category Name" required error={errCreate.name?.message} placeholder="e.g. Desktop, Printer" {...regCreate('name')} />
          <Textarea label="Description" rows={2} placeholder="Optional description" {...regCreate('description')} />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.close} title="Edit Category" size="sm"
        footer={<><Button variant="secondary" onClick={editModal.close}>Cancel</Button><Button form="edit-cat" type="submit" loading={subEdit}>Save</Button></>}
      >
        <form id="edit-cat" onSubmit={handleEdit(d => updateMutation.mutate(d))} className="flex flex-col gap-4">
          <Input label="Category Name" required error={errEdit.name?.message} {...regEdit('name')} />
          <Textarea label="Description" rows={2} {...regEdit('description')} />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete Category?"
        message={
          deleteTarget?.asset_count > 0
            ? `⚠️ Cannot delete "${deleteTarget?.name}" — it has ${deleteTarget.asset_count} asset(s) associated with it. Please reassign or delete those assets first.`
            : `This will permanently delete the "${deleteTarget?.name}" category and all its custom field definitions. This cannot be undone.`
        }
        confirmLabel="Delete"
        confirmDisabled={deleteTarget?.asset_count > 0}
      />
    </div>
  )
}

export default CategoriesPage
