import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { consumableApi } from '../../../api/consumableApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Drawer from '../../../components/ui/Drawer'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import SearchInput from '../../../components/ui/SearchInput'
import Badge from '../../../components/ui/Badge'
import { PageLoader } from '../../../components/ui/Loader'
import EmptyState from '../../../components/ui/EmptyState'
import Tabs from '../../../components/ui/Tabs'
import Pagination from '../../../components/ui/Pagination'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../store/ToastContext'
import { formatDate, formatDateTime } from '../../../utils/formatters'
import useDisclosure from '../../../hooks/useDisclosure'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const consumableSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  unit: z.string().optional(),
  remarks: z.string().optional(),
})

const stockSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Must be at least 1'),
  reference: z.string().optional(),
})

// ─── Stock Action Modal ────────────────────────────────────────
const StockModal = ({ isOpen, onClose, type, consumable, onSuccess }) => {
  const toast = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(stockSchema) })

  const titles = { stock_in: 'Stock In', stock_out: 'Stock Out', damaged: 'Mark as Damaged' }
  const variants = { stock_in: 'success', stock_out: 'primary', damaged: 'danger' }

  const onSubmit = async (data) => {
    try {
      if (type === 'stock_in') await consumableApi.stockIn(consumable.id, data)
      else if (type === 'stock_out') await consumableApi.stockOut(consumable.id, data)
      else await consumableApi.markDamaged(consumable.id, data)
      toast.success('Stock updated successfully')
      reset()
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose() }} title={`${titles[type]} — ${consumable?.name}`} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button variant={variants[type]} form="stock-form" type="submit" loading={isSubmitting}>{titles[type]}</Button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Quantity" type="number" min={1} required error={errors.quantity?.message} {...register('quantity')} />
        <Input label="Reference / Note" placeholder="Invoice number, reason..." {...register('reference')} />
        {type === 'stock_out' && consumable && (
          <p className="text-xs text-slate-500 bg-blue-50 px-3 py-2 rounded-lg">
            Available stock: <strong>{Math.max(0, consumable.current_stock - consumable.damaged_quantity)}</strong> {consumable.unit || 'units'}
          </p>
        )}
      </form>
    </Modal>
  )
}

// ─── Consumable Detail Drawer ──────────────────────────────────
const ConsumableDetailDrawer = ({ isOpen, onClose, consumable, onUpdated }) => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [stockModal, setStockModal] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [txPage, setTxPage] = useState(1)

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['consumable-transactions', consumable?.id, txPage],
    queryFn: () => consumableApi.getTransactions(consumable.id, { page: txPage, limit: 20 }).then(r => r.data),
    enabled: !!consumable?.id && activeTab === 'transactions',
  })

  const deleteMutation = useMutation({
    mutationFn: () => consumableApi.delete(consumable.id),
    onSuccess: () => { 
      toast.success('Consumable deleted')
      queryClient.invalidateQueries({ queryKey: ['consumables'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onClose() 
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  if (!consumable) return null
  const available = Math.max(0, consumable.current_stock - consumable.damaged_quantity)

  return (
    <>
      <Drawer 
        isOpen={isOpen} 
        onClose={onClose} 
        title={consumable.name} 
        width="max-w-lg"
        footer={
          <div className="flex justify-start w-full">
            <Button variant="danger-ghost" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete Consumable
            </Button>
          </div>
        }
      >
        {/* Stock Summary */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: 'In Stock', value: consumable.current_stock, color: 'text-slate-800' },
          { label: 'Issued', value: (consumable.current_stock - consumable.damaged_quantity - available), color: 'text-indigo-600' },
          { label: 'Damaged', value: consumable.damaged_quantity, color: 'text-red-600' },
          { label: 'Available', value: available, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'transactions', label: 'Transactions' }]}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-4"
      />

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            {[
              { label: 'Category', value: consumable.category },
              { label: 'Unit', value: consumable.unit },
              { label: 'Remarks', value: consumable.remarks },
            ].map(f => f.value ? (
              <div key={f.label} className="flex items-start gap-3 py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 w-24 shrink-0 pt-0.5">{f.label}</span>
                <span className="text-sm text-slate-800">{f.value}</span>
              </div>
            ) : null)}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock Actions</p>
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={() => setStockModal('stock_in')}>+ Stock In</Button>
              <Button variant="secondary" size="sm" onClick={() => setStockModal('stock_out')}>↑ Stock Out</Button>
              <Button variant="danger-ghost" size="sm" onClick={() => setStockModal('damaged')}>⚠ Mark Damaged</Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div>
          {txLoading ? <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            : (txData?.data || []).length === 0 ? <EmptyState title="No transactions yet" />
            : (
              <div className="space-y-2">
                {(txData?.data || []).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                    <Badge status={tx.transaction_type} label={tx.transaction_type === 'stock_in' ? 'In' : tx.transaction_type === 'stock_out' ? 'Out' : 'Damaged'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {tx.transaction_type === 'stock_in' ? '+' : tx.transaction_type === 'damaged' ? '⚠' : '-'}{tx.quantity} {consumable.unit || 'units'}
                      </p>
                      {tx.reference && <p className="text-xs text-slate-500 truncate">{tx.reference}</p>}
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{formatDate(tx.created_at)}</p>
                  </div>
                ))}
                {txData?.meta?.totalPages > 1 && (
                  <div className="pt-2"><Pagination meta={txData.meta} onPageChange={setTxPage} /></div>
                )}
              </div>
            )}
        </div>
      )}

      {stockModal && (
        <StockModal
          isOpen={!!stockModal}
          onClose={() => setStockModal(null)}
          type={stockModal}
          consumable={consumable}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['consumables'] }); queryClient.invalidateQueries({ queryKey: ['consumable-transactions', consumable.id] }); onUpdated?.() }}
        />
      )}
    </Drawer>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete Consumable?"
        message={
          consumable.current_stock > 0
            ? `⚠️ "${consumable.name}" currently has ${consumable.current_stock} unit(s) in stock (${available} available, ${consumable.damaged_quantity} damaged). Deleting this will permanently remove all stock data and transaction history. This cannot be undone.`
            : `This will permanently delete "${consumable.name}" and all its stock history. This action cannot be undone.`
        }
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </>
  )
}

// ─── Consumable Card ───────────────────────────────────────────
const ConsumableCard = ({ consumable, onClick }) => {
  const available = Math.max(0, consumable.current_stock - consumable.damaged_quantity)
  const isLow = available < 10

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all duration-150 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        {isLow && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            Low Stock
          </span>
        )}
      </div>

      <h3 className="font-semibold text-slate-800 text-sm mb-0.5 truncate">{consumable.name}</h3>
      {consumable.category && <p className="text-xs text-slate-500 mb-3">{consumable.category}</p>}

      <div className="flex items-end justify-between">
        <div>
          <p className={`text-2xl font-bold ${isLow ? 'text-amber-600' : 'text-emerald-600'}`}>{available}</p>
          <p className="text-xs text-slate-400">available {consumable.unit ? `(${consumable.unit})` : ''}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>{consumable.current_stock} in stock</p>
          {consumable.damaged_quantity > 0 && <p className="text-red-400">{consumable.damaged_quantity} damaged</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
const ConsumablesPage = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const createModal = useDisclosure()
  const [selectedConsumable, setSelectedConsumable] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['consumables', search, page],
    queryFn: () => consumableApi.getAll({ search, page, limit: 24 }).then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(consumableSchema) })

  const createMutation = useMutation({
    mutationFn: (d) => consumableApi.create(d),
    onSuccess: () => { toast.success('Consumable added'); queryClient.invalidateQueries({ queryKey: ['consumables'] }); createModal.close(); reset() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create'),
  })

  const items = data?.data || []
  const meta = data?.meta

  return (
    <div>
      <PageHeader
        title="Consumables"
        subtitle={meta ? `${meta.total} items tracked` : 'Track stock of consumables'}
        actions={
          <Button onClick={createModal.open} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
            Add Consumable
          </Button>
        }
      />

      <div className="mb-5">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search consumables..." className="w-72" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No consumables yet"
          message="Add consumables like cartridges, cables, keyboards to track their stock"
          action={<Button onClick={createModal.open}>Add First Consumable</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(item => (
            <ConsumableCard key={item.id} consumable={item} onClick={() => setSelectedConsumable(item)} />
          ))}
        </div>
      )}

      {meta?.totalPages > 1 && (
        <div className="mt-6"><Pagination meta={meta} onPageChange={setPage} /></div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onClose={() => { createModal.close(); reset() }} title="Add Consumable" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { createModal.close(); reset() }}>Cancel</Button>
            <Button form="consumable-form" type="submit" loading={isSubmitting}>Add</Button>
          </>
        }
      >
        <form id="consumable-form" onSubmit={handleSubmit(d => createMutation.mutate(d))} className="flex flex-col gap-4">
          <Input label="Item Name" required error={errors.name?.message} placeholder="e.g. HP 88A Cartridge" {...register('name')} />
          <Input label="Category" placeholder="e.g. Cartridges, Cables" {...register('category')} />
          <Input label="Unit" placeholder="e.g. pieces, boxes, meters" {...register('unit')} />
          <Textarea label="Remarks" rows={2} {...register('remarks')} />
        </form>
      </Modal>

      {/* Detail Drawer */}
      {selectedConsumable && (
        <ConsumableDetailDrawer
          isOpen={!!selectedConsumable}
          onClose={() => setSelectedConsumable(null)}
          consumable={selectedConsumable}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['consumables'] })}
        />
      )}
    </div>
  )
}

export default ConsumablesPage
