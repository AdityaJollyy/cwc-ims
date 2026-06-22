import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { consumableApi } from '../../../api/consumableApi'
import { employeeApi } from '../../../api/employeeApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Drawer from '../../../components/ui/Drawer'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import SearchInput from '../../../components/ui/SearchInput'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import Badge from '../../../components/ui/Badge'
import EmptyState from '../../../components/ui/EmptyState'
import Tabs from '../../../components/ui/Tabs'
import Pagination from '../../../components/ui/Pagination'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import DataTable from '../../../components/ui/DataTable'
import { useToast } from '../../../store/ToastContext'
import { formatDate, formatDateTime, getDaysActive } from '../../../utils/formatters'
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

const inputCls = 'w-full h-9 pl-3 pr-3 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white'

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

// ─── Issue Modal ───────────────────────────────────────────────
const IssueModal = ({ isOpen, onClose, consumable, onSuccess }) => {
  const toast = useToast()
  const [employeeId, setEmployeeId] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [issueType, setIssueType] = useState('returnable') // 'returnable' | 'consumed'
  const [assignedAt, setAssignedAt] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: employees, isLoading: empsLoading } = useQuery({
    queryKey: ['employees-active', empSearch],
    queryFn: () => employeeApi.getAll({ is_archived: false, search: empSearch, limit: 100 }).then(r => r.data.data),
    enabled: isOpen,
    keepPreviousData: true,
  })

  const employeeOptions = (employees || []).map(e => ({
    value: String(e.id),
    label: e.name,
    sublabel: [e.employee_code, e.division].filter(Boolean).join(' · '),
  }))

  const reset = () => { setEmployeeId(''); setQuantity(1); setIssueType('returnable'); setAssignedAt(''); setRemarks('') }
  const close = () => { reset(); onClose() }

  const available = consumable
    ? Math.max(0, consumable.current_stock - consumable.damaged_quantity)
    : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!employeeId) return toast.error('Please select an employee')
    if (quantity < 1) return toast.error('Quantity must be at least 1')
    if (quantity > available) return toast.error(`Only ${available} ${consumable.unit || 'units'} available`)

    setSubmitting(true)
    try {
      await consumableApi.issue(consumable.id, {
        employee_id: employeeId,
        quantity: Number(quantity),
        is_returnable: issueType === 'returnable',
        assigned_at: assignedAt || undefined,
        remarks: remarks || undefined,
      })
      toast.success(issueType === 'returnable'
        ? 'Item issued — tracked as returnable'
        : 'Item issued — consumed on issue')
      reset()
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue item')
    } finally {
      setSubmitting(false)
    }
  }

  if (!consumable) return null

  return (
    <Modal isOpen={isOpen} onClose={close} title={`Issue — ${consumable.name}`} size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={available < 1}>Issue Item</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <SearchableSelect
          label="Employee"
          required
          placeholder="Select employee..."
          options={employeeOptions}
          value={employeeId}
          onChange={setEmployeeId}
          onSearchChange={setEmpSearch}
          loading={empsLoading}
        />

        <Input
          label="Quantity"
          type="number"
          min={1}
          max={available}
          required
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Issue Type <span className="text-red-500">*</span></p>
          <div className="flex flex-col gap-2">
            {[
              {
                value: 'returnable',
                label: '🔄 Returnable',
                desc: 'Tracked under the employee — must be returned later (e.g. mouse, keyboard).',
              },
              {
                value: 'consumed',
                label: '📦 Consumed on issue',
                desc: 'Stock leaves permanently — no return tracking (e.g. cartridge, ink).',
              },
            ].map(opt => (
              <label key={opt.value} className={[
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                issueType === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}>
                <input type="radio" value={opt.value} checked={issueType === opt.value}
                  onChange={() => setIssueType(opt.value)} className="mt-0.5 accent-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Issue Date <span className="text-slate-400 text-xs">(defaults to today)</span></label>
          <input type="date" value={assignedAt} onChange={e => setAssignedAt(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Remarks <span className="text-slate-400 text-xs">(optional)</span></label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
            placeholder="Any notes..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
        </div>

        <p className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
          Available: <strong>{available}</strong> {consumable.unit || 'units'}
        </p>
      </form>
    </Modal>
  )
}

// ─── Return Issuance Modal ─────────────────────────────────────
const ReturnIssuanceModal = ({ isOpen, onClose, assignment, onSuccess }) => {
  const toast = useToast()
  const [returnedQty, setReturnedQty] = useState(0)
  const [condition, setCondition] = useState('good')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => { setReturnedQty(0); setCondition('good'); setRemarks('') }
  const close = () => { reset(); onClose() }

  const handleReturn = async () => {
    if (returnedQty > assignment.quantity) {
      return toast.error(`Cannot return more than ${assignment.quantity} ${assignment.consumable_unit || 'units'}`)
    }
    setSubmitting(true)
    try {
      await consumableApi.returnIssue(assignment.id, {
        returned_quantity: Number(returnedQty),
        condition,
        remarks: remarks || undefined,
      })
      toast.success(condition === 'damaged' ? 'Return recorded — units marked as damaged' : 'Return recorded successfully')
      reset()
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!assignment) return null
  const unit = assignment.consumable_unit || 'units'

  return (
    <Modal isOpen={isOpen} onClose={close} title="Process Return" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant={condition === 'damaged' ? 'danger' : 'success'} onClick={handleReturn} loading={submitting}>
            Confirm Return
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-500 text-xs mb-1">Returning</p>
          <p className="font-medium text-slate-800">{assignment.consumable_name}</p>
          <p className="text-slate-500">From: {assignment.employee_name}{assignment.employee_code ? ` (${assignment.employee_code})` : ''}</p>
          <p className="text-slate-500">Issued: {assignment.quantity} {unit}</p>
        </div>

        <Input
          label={`Quantity returned (max ${assignment.quantity})`}
          type="number"
          min={0}
          max={assignment.quantity}
          value={returnedQty}
          onChange={e => setReturnedQty(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Return Condition <span className="text-red-500">*</span></p>
          <div className="flex flex-col gap-2">
            {[
              { value: 'good', label: '✅ Good Condition', desc: 'Returned units go back into available stock' },
              { value: 'damaged', label: '⚠️ Damaged', desc: 'Returned units will be marked as damaged' },
            ].map(opt => (
              <label key={opt.value} className={[
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                condition === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}>
                <input type="radio" value={opt.value} checked={condition === opt.value}
                  onChange={() => setCondition(opt.value)} className="mt-0.5 accent-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Textarea label="Remarks" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any notes..." />
      </div>
    </Modal>
  )
}

// ─── Transaction Detail Modal ──────────────────────────────────
const TX_LABELS = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  damaged: 'Marked Damaged',
  issued: 'Issued',
  returned: 'Returned',
}

const TransactionDetailModal = ({ isOpen, onClose, transaction, consumable }) => {
  if (!transaction) return null

  const unit = consumable?.unit || 'units'
  const sign = transaction.transaction_type === 'stock_in' || transaction.transaction_type === 'returned'
    ? '+'
    : transaction.transaction_type === 'damaged'
      ? '⚠'
      : '-'

  const rows = [
    { label: 'Type', value: <Badge status={transaction.transaction_type} /> },
    { label: 'Quantity', value: <span className="font-semibold text-slate-800">{sign}{transaction.quantity} {unit}</span> },
    { label: 'Date of Issue', value: formatDateTime(transaction.created_at) },
    transaction.employee_name ? { label: 'Employee', value: `${transaction.employee_name}${transaction.employee_code ? ` (${transaction.employee_code})` : ''}` } : null,
    transaction.reference ? { label: 'Reference', value: transaction.reference } : null,
    transaction.performed_by_name ? { label: 'Performed By', value: transaction.performed_by_name } : null,
  ].filter(Boolean)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Transaction — ${TX_LABELS[transaction.transaction_type] || transaction.transaction_type}`}
      size="sm"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col">
        {rows.map(r => (
          <div key={r.label} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{r.label}</span>
            <span className="text-sm text-slate-800 flex-1 break-words">{r.value}</span>
          </div>
        ))}

        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-1.5">Remarks</p>
          <div className="text-sm text-slate-800 bg-slate-50 rounded-lg px-3 py-2.5 min-h-[3rem] whitespace-pre-wrap break-words">
            {transaction.remarks || <span className="text-slate-400 italic">No remarks</span>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Detail Drawer ─────────────────────────────────────────────
const ConsumableDetailDrawer = ({ isOpen, onClose, consumable: initialConsumable, onUpdated }) => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [stockModal, setStockModal] = useState(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [returnAssignment, setReturnAssignment] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [txPage, setTxPage] = useState(1)
  const [selectedTx, setSelectedTx] = useState(null)

  // Fetch live data so stock/issue counters update after every action.
  const { data: liveConsumable } = useQuery({
    queryKey: ['consumable', initialConsumable?.id],
    queryFn: () => consumableApi.getById(initialConsumable.id).then(r => r.data.data),
    enabled: !!initialConsumable?.id && isOpen,
  })
  const consumable = liveConsumable || initialConsumable

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['consumable-transactions', consumable?.id, txPage],
    queryFn: () => consumableApi.getTransactions(consumable.id, { page: txPage, limit: 20 }).then(r => r.data),
    enabled: !!consumable?.id && activeTab === 'transactions',
  })

  const { data: issuancesData, isLoading: issuancesLoading } = useQuery({
    queryKey: ['consumable-issuances', consumable?.id],
    queryFn: () => consumableApi.getAssignments({ consumable_id: consumable.id, is_active: true, limit: 100 }).then(r => r.data.data),
    enabled: !!consumable?.id && activeTab === 'issuances',
  })

  const deleteMutation = useMutation({
    mutationFn: () => consumableApi.delete(consumable.id),
    onSuccess: () => {
      toast.success(`"${consumable.name}" deleted permanently`)
      queryClient.invalidateQueries({ queryKey: ['consumables'] })
      queryClient.invalidateQueries({ queryKey: ['consumables-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onClose()
    },
    onError: (err) => {
      setDeleteOpen(false)
      toast.error(err.response?.data?.message || 'Delete failed')
    },
  })

  // ─── Edit form state ─────────────────────────────────────────────
  const editSchema = z.object({
    category: z.string().optional(),
    unit: z.string().optional(),
    remarks: z.string().optional(),
  })
  const { register: editRegister, handleSubmit: editHandleSubmit, reset: editReset, formState: { errors: editErrors, isSubmitting: editSubmitting } } = useForm({
    resolver: zodResolver(editSchema),
  })

  const openEdit = () => {
    editReset({ category: consumable.category || '', unit: consumable.unit || '', remarks: consumable.remarks || '' })
    setEditOpen(true)
  }

  const editMutation = useMutation({
    mutationFn: (d) => consumableApi.update(consumable.id, d),
    onSuccess: () => {
      toast.success('Item updated')
      queryClient.invalidateQueries({ queryKey: ['consumables'] })
      queryClient.invalidateQueries({ queryKey: ['consumable', consumable.id] })
      queryClient.invalidateQueries({ queryKey: ['consumables-dashboard'] })
      setEditOpen(false)
      onUpdated?.()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['consumables'] })
    queryClient.invalidateQueries({ queryKey: ['consumable', consumable.id] })
    queryClient.invalidateQueries({ queryKey: ['consumables-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['consumable-transactions', consumable.id] })
    queryClient.invalidateQueries({ queryKey: ['consumable-issuances', consumable.id] })
    queryClient.invalidateQueries({ queryKey: ['consumable-issuances-active'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    onUpdated?.()
  }

  if (!consumable) return null
  const available = Math.max(0, consumable.current_stock - consumable.damaged_quantity)
  const issued = parseInt(consumable.issued_quantity || 0, 10)

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'issuances', label: `Active Issuances${issued > 0 ? ` (${issued})` : ''}` },
    { id: 'transactions', label: 'Transactions' },
  ]

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={consumable.name}
        width="max-w-lg"
        footer={
          <div className="flex justify-between w-full items-center">
            <Button variant="danger-ghost" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete Item
            </Button>
            <Button variant="secondary" size="sm" onClick={openEdit}>
              ✏️ Edit Details
            </Button>
          </div>
        }
      >
        {/* Stock Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            { label: 'In Stock', value: consumable.current_stock, color: 'text-slate-800' },
            { label: 'Issued', value: issued, color: 'text-indigo-600', hint: 'returnable, awaiting return' },
            { label: 'Damaged', value: consumable.damaged_quantity, color: 'text-red-600' },
            { label: 'Available', value: available, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100" title={s.hint || ''}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {consumable.category && (
          <div className="mb-4">
            <span className="text-xs text-slate-500">{consumable.category}</span>
          </div>
        )}

        <Tabs
          tabs={tabs}
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
              <div className="flex gap-2 flex-wrap">
                <Button variant="success" size="sm" onClick={() => setStockModal('stock_in')}>+ Stock In</Button>
                <Button variant="secondary" size="sm" onClick={() => setStockModal('stock_out')}>↑ Stock Out</Button>
                <Button variant="danger-ghost" size="sm" onClick={() => setStockModal('damaged')}>⚠ Mark Damaged</Button>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-3">Issue to Employee</p>
              <Button size="sm" onClick={() => setIssueOpen(true)} disabled={available < 1}>
                Issue Item
              </Button>
              {available < 1 && <p className="text-xs text-amber-600">No stock available to issue</p>}
              <p className="text-xs text-slate-500">You'll choose returnable or consumed-on-issue when issuing.</p>
            </div>
          </div>
        )}

        {activeTab === 'issuances' && (
          <div>
            {issuancesLoading ? (
              <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : (issuancesData || []).length === 0 ? (
              <EmptyState title="No active issuances" message="No employees currently have this item awaiting return" />
            ) : (
              <div className="space-y-2">
                {(issuancesData || []).map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{a.employee_name}</p>
                      <p className="text-xs text-slate-500">{[a.employee_code, `${a.quantity} ${consumable.unit || 'units'}`, `${getDaysActive(a.assigned_at)}d ago`].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Button size="xs" variant="secondary" onClick={() => setReturnAssignment(a)}>Return</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            {txLoading ? <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
              : (txData?.data || []).length === 0 ? <EmptyState title="No transactions yet" />
              : (
                <div className="space-y-2">
                  {(txData?.data || []).map(tx => (
                    <button
                      type="button"
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-indigo-200 transition-all text-left"
                    >
                      <Badge status={tx.transaction_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {tx.transaction_type === 'stock_in' || tx.transaction_type === 'returned' ? '+' : tx.transaction_type === 'damaged' ? '⚠' : '-'}{tx.quantity} {consumable.unit || 'units'}
                        </p>
                        {tx.employee_name && <p className="text-xs text-slate-500 truncate">{tx.employee_name}{tx.employee_code ? ` (${tx.employee_code})` : ''}</p>}
                        {tx.reference && !tx.employee_name && <p className="text-xs text-slate-500 truncate">{tx.reference}</p>}
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">{formatDate(tx.created_at)}</p>
                    </button>
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
            onSuccess={refresh}
          />
        )}
      </Drawer>

      <IssueModal
        isOpen={issueOpen}
        onClose={() => setIssueOpen(false)}
        consumable={consumable}
        onSuccess={refresh}
      />

      <ReturnIssuanceModal
        isOpen={!!returnAssignment}
        onClose={() => setReturnAssignment(null)}
        assignment={returnAssignment}
        onSuccess={refresh}
      />

      <TransactionDetailModal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
        consumable={consumable}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete "${consumable.name}"?`}
        message={
          issued > 0
            ? `⚠️ "${consumable.name}" is currently issued to employees as returnable (${issued} ${consumable.unit || 'units'} active). Process all returns before deleting.`
            : consumable.current_stock > 0
              ? `⚠️ "${consumable.name}" still has ${consumable.current_stock} ${consumable.unit || 'units'} in stock (${available} available, ${consumable.damaged_quantity} damaged). Deleting will permanently remove the item along with its full transaction and issuance history. This action cannot be undone.`
              : `This will permanently delete "${consumable.name}" along with its full transaction and issuance history. This action cannot be undone.`
        }
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        confirmDisabled={issued > 0}
      />

      {/* Edit Details Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit — ${consumable.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button form="consumable-edit-form" type="submit" loading={editSubmitting || editMutation.isPending}>Save Changes</Button>
          </>
        }
      >
        <form id="consumable-edit-form" onSubmit={editHandleSubmit(d => editMutation.mutate(d))} className="flex flex-col gap-4">
          <Input label="Category" placeholder="e.g. Peripherals, Cartridges" error={editErrors.category?.message} {...editRegister('category')} />
          <Input label="Unit" placeholder="e.g. pieces, boxes, meters" error={editErrors.unit?.message} {...editRegister('unit')} />
          <Textarea label="Remarks" rows={3} placeholder="Any notes..." error={editErrors.remarks?.message} {...editRegister('remarks')} />
        </form>
      </Modal>
    </>
  )
}

// ─── Card ──────────────────────────────────────────────────────
const ConsumableCard = ({ consumable, onClick }) => {
  const available = Math.max(0, consumable.current_stock - consumable.damaged_quantity)
  const isLow = available < 10
  const issued = parseInt(consumable.issued_quantity || 0, 10)

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
          {issued > 0 && <p className="text-indigo-500">{issued} out (returnable)</p>}
          {consumable.damaged_quantity > 0 && <p className="text-red-400">{consumable.damaged_quantity} damaged</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Issuances Tab (page-level) ────────────────────────────────
const IssuancesTab = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [returnAssignment, setReturnAssignment] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['consumable-issuances-active', search, page],
    queryFn: () => consumableApi.getAssignments({ is_active: true, search, page, limit: 25 }).then(r => r.data),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['consumable-issuances-active'] })
    queryClient.invalidateQueries({ queryKey: ['consumables'] })
    queryClient.invalidateQueries({ queryKey: ['consumables-dashboard'] })
  }

  const columns = [
    {
      key: 'employee_name', header: 'Employee',
      render: (v, r) => <div><p className="font-medium text-slate-800">{v}</p>{r.employee_code && <p className="text-xs text-slate-400">{r.employee_code}</p>}</div>,
    },
    {
      key: 'consumable_name', header: 'Item',
      render: (v, r) => <div><p className="font-medium">{v}</p><p className="text-xs text-slate-500">{r.consumable_category || ''}</p></div>,
    },
    { key: 'quantity', header: 'Qty', render: (v, r) => <span className="font-medium">{v} {r.consumable_unit || 'units'}</span> },
    { key: 'assigned_at', header: 'Issued On', render: v => formatDate(v) },
    // { key: 'days_active', header: 'Days Active', render: (_, r) => <span className="font-medium">{getDaysActive(r.assigned_at)}d</span> },
    {
      key: 'actions', header: '', width: '90px',
      render: (_, row) => <Button variant="secondary" size="xs" onClick={() => setReturnAssignment(row)}>Return</Button>,
    },
  ]

  const items = data?.data || []
  const meta = data?.meta

  return (
    <>
      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search employee or item..." className="w-full sm:w-72" />
      </div>
      <DataTable columns={columns} data={items} isLoading={isLoading} emptyMessage="No active issuances" />
      {meta?.totalPages > 1 && <div className="mt-4"><Pagination meta={meta} onPageChange={setPage} /></div>}

      <ReturnIssuanceModal
        isOpen={!!returnAssignment}
        onClose={() => setReturnAssignment(null)}
        assignment={returnAssignment}
        onSuccess={refresh}
      />
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
const ConsumablesPage = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const createModal = useDisclosure()
  const [activeTab, setActiveTab] = useState('items')
  const [selectedConsumable, setSelectedConsumable] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['consumables', search, page],
    queryFn: () => consumableApi.getAll({ search, page, limit: 24 }).then(r => r.data),
    enabled: activeTab === 'items',
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(consumableSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d) => consumableApi.create(d),
    onSuccess: () => { toast.success('Item added'); queryClient.invalidateQueries({ queryKey: ['consumables'] }); createModal.close(); reset() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create'),
  })

  const items = data?.data || []
  const meta = data?.meta

  return (
    <div>
      <PageHeader
        title="Bulk Inventory"
        subtitle={meta && activeTab === 'items' ? `${meta.total} items tracked` : 'Track stock and employee issuances'}
        actions={
          <Button onClick={createModal.open} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
            Add Item
          </Button>
        }
      />

      <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-fit">
        {[{ id: 'items', label: 'Items' }, { id: 'issuances', label: 'Active Issuances' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={['px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'].join(' ')}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'items' && (
        <>
          <div className="mb-5">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search items..." className="w-full sm:w-72" />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No items yet"
              message="Add bulk-stock items like cartridges, cables, mice, or keyboards to track inventory and employee issuances"
              action={<Button onClick={createModal.open}>Add First Item</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map(item => (
                <ConsumableCard key={item.id} consumable={item} onClick={() => setSelectedConsumable(item)} />
              ))}
            </div>
          )}

          {meta?.totalPages > 1 && (
            <div className="mt-6"><Pagination meta={meta} onPageChange={setPage} /></div>
          )}
        </>
      )}

      {activeTab === 'issuances' && <IssuancesTab />}

      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onClose={() => { createModal.close(); reset() }} title="Add Bulk Inventory Item" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { createModal.close(); reset() }}>Cancel</Button>
            <Button form="consumable-form" type="submit" loading={isSubmitting}>Add Item</Button>
          </>
        }
      >
        <form id="consumable-form" onSubmit={handleSubmit(d => createMutation.mutate(d))} className="flex flex-col gap-4">
          <Input label="Item Name" required error={errors.name?.message} placeholder="e.g. Wireless Mouse, HP 88A Cartridge" {...register('name')} />
          <Input label="Category" placeholder="e.g. Peripherals, Cartridges" {...register('category')} />
          <Input label="Unit" placeholder="e.g. pieces, boxes, meters" {...register('unit')} />
          <Textarea label="Remarks" rows={2} {...register('remarks')} />
          <p className="text-xs text-slate-500 bg-blue-50 px-3 py-2 rounded-lg">
            💡 You'll choose returnable or consumed-on-issue each time you issue this item to an employee — so the same item can be either, depending on context.
          </p>
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
