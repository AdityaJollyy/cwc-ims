import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assignmentApi } from '../../../api/assignmentApi'
import { employeeApi } from '../../../api/employeeApi'
import { assetApi } from '../../../api/assetApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import DataTable from '../../../components/ui/DataTable'
import Pagination from '../../../components/ui/Pagination'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import SearchInput from '../../../components/ui/SearchInput'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import { useToast } from '../../../store/ToastContext'
import { useAuth } from '../../../store/AuthContext'
import { formatDate, getDaysActive } from '../../../utils/formatters'
import useDisclosure from '../../../hooks/useDisclosure'

// ─── Assign Modal ─────────────────────────────────────────────
const AssignModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast()
  const [form, setForm] = useState({ employee_id: '', asset_id: '', serial_number: '', asset_number: '', assigned_at: '', remarks: '' })
  const [submitting, setSubmitting] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const [assetSearch, setAssetSearch] = useState('')

  const { data: employees, isLoading: empsLoading } = useQuery({
    queryKey: ['employees-active', empSearch],
    queryFn: () => employeeApi.getAll({ is_archived: false, search: empSearch, limit: 100 }).then(r => r.data.data),
    enabled: isOpen,
    keepPreviousData: true,
  })

  const { data: availableAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets-available', assetSearch],
    queryFn: () => assetApi.getAll({ status: 'available', search: assetSearch, limit: 100 }).then(r => r.data.data),
    enabled: isOpen,
    keepPreviousData: true,
  })

  const employeeOptions = (employees || []).map(e => ({
    value: String(e.id),
    label: e.name,
    sublabel: [e.employee_code, e.division].filter(Boolean).join(' · '),
  }))

  const assetOptions = (availableAssets || []).map(a => ({
    value: String(a.id),
    label: a.product_name || `Asset #${a.id}`,
    sublabel: [a.category_name, a.model, a.serial_number].filter(Boolean).join(' · '),
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.employee_id || !form.asset_id) return toast.error('Please select employee and asset')
    setSubmitting(true)
    try {
      await assignmentApi.assign({
        employee_id: form.employee_id,
        asset_id: form.asset_id,
        serial_number: form.serial_number || undefined,
        asset_number: form.asset_number || undefined,
        assigned_at: form.assigned_at || undefined,
        remarks: form.remarks || undefined,
      })
      toast.success('Asset assigned successfully')
      setForm({ employee_id: '', asset_id: '', serial_number: '', asset_number: '', assigned_at: '', remarks: '' })
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full h-9 pl-3 pr-3 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Asset to Employee" size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Assign Asset</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <SearchableSelect
          label="Employee"
          required
          placeholder="Select employee..."
          options={employeeOptions}
          value={form.employee_id}
          onChange={(v) => setForm(f => ({ ...f, employee_id: v }))}
          onSearchChange={setEmpSearch}
          loading={empsLoading}
        />

        <SearchableSelect
          label="Asset"
          required
          placeholder="Select available asset..."
          options={assetOptions}
          value={form.asset_id}
          onChange={(v) => setForm(f => ({ ...f, asset_id: v }))}
          onSearchChange={setAssetSearch}
          loading={assetsLoading}
          emptyMessage="No available assets"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Serial Number <span className="text-slate-400 text-xs">(optional)</span></label>
            <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="Will update asset record" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Asset Number <span className="text-slate-400 text-xs">(optional)</span></label>
            <input value={form.asset_number} onChange={e => setForm(f => ({ ...f, asset_number: e.target.value }))} placeholder="Will update asset record" className={inputCls} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Assignment Date <span className="text-slate-400 text-xs">(defaults to today)</span></label>
          <input type="date" value={form.assigned_at} onChange={e => setForm(f => ({ ...f, assigned_at: e.target.value }))} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Remarks <span className="text-slate-400 text-xs">(optional)</span></label>
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Any notes..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
        </div>

        <p className="text-xs text-slate-500 bg-indigo-50 px-3 py-2 rounded-lg">
          💡 If you enter a serial number or asset number, it will be saved directly to the asset record.
        </p>
      </form>
    </Modal>
  )
}

// ─── Return Modal ─────────────────────────────────────────────
const ReturnModal = ({ isOpen, onClose, assignment, onSuccess }) => {
  const toast = useToast()
  const [condition, setCondition] = useState('good')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleReturn = async () => {
    setSubmitting(true)
    try {
      await assignmentApi.return(assignment.id, { condition, remarks: remarks || undefined })
      toast.success(condition === 'damaged' ? 'Asset returned — marked as damaged' : 'Asset returned successfully')
      setCondition('good'); setRemarks('')
      onSuccess(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Return Asset" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={condition === 'damaged' ? 'danger' : 'success'} onClick={handleReturn} loading={submitting}>
            Confirm Return
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {assignment && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <p className="text-slate-500 text-xs mb-1">Returning</p>
            <p className="font-medium text-slate-800">{assignment.product_name || assignment.category_name}{assignment.serial_number ? ` — ${assignment.serial_number}` : ''}</p>
            <p className="text-slate-500">From: {assignment.employee_name}</p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Return Condition <span className="text-red-500">*</span></p>
          <div className="flex flex-col gap-2">
            {[
              { value: 'good', label: '✅ Good Condition', desc: 'Asset is functional and undamaged' },
              { value: 'damaged', label: '⚠️ Damaged', desc: 'Asset will be marked as damaged' },
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Remarks <span className="text-slate-400 text-xs">(optional)</span></label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
            placeholder="Any notes about the return..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
const AssignmentsPage = () => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { isAdmin } = useAuth()
  const assignModal = useDisclosure()
  const returnModal = useDisclosure()
  const deleteDialog = useDisclosure()
  const [activeTab, setActiveTab] = useState('active')
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['assignments-active', search, page],
    queryFn: () => assignmentApi.getAll({ is_active: true, search, page, limit: 25 }).then(r => r.data),
    enabled: activeTab === 'active',
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['assignments-history', search, page],
    queryFn: () => assignmentApi.getHistory({ search, page, limit: 25 }).then(r => r.data),
    enabled: activeTab === 'history',
  })

  const handleReturnClick = (assignment) => {
    setSelectedAssignment(assignment)
    returnModal.open()
  }

  const handleDeleteClick = (assignment) => {
    setSelectedAssignment(assignment)
    deleteDialog.open()
  }

  const deleteMutation = useMutation({
    mutationFn: (id) => assignmentApi.delete(id),
    onSuccess: () => {
      toast.success('Assignment record deleted')
      queryClient.invalidateQueries({ queryKey: ['assignments-history'] })
      queryClient.invalidateQueries({ queryKey: ['assignments-active'] })
      deleteDialog.close()
      setSelectedAssignment(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete assignment'),
  })

  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['assignments-active'] })
    queryClient.invalidateQueries({ queryKey: ['assignments-history'] })
    queryClient.invalidateQueries({ queryKey: ['assets'] })
    queryClient.invalidateQueries({ queryKey: ['asset'] })
    queryClient.invalidateQueries({ queryKey: ['assets-available'] })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
    queryClient.invalidateQueries({ queryKey: ['employees-active'] })
    queryClient.invalidateQueries({ queryKey: ['employee'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const activeColumns = [
    { key: 'employee_name', header: 'Employee', render: (v, r) => <div><p className="font-medium text-slate-800">{v}</p>{r.employee_code && <p className="text-xs text-slate-400">{r.employee_code}</p>}</div> },
    { key: 'product_name', header: 'Asset', render: (_, r) => <div><p className="font-medium text-slate-800">{r.product_name || r.category_name}</p>{r.serial_number && <p className="font-mono text-xs text-slate-500">{r.serial_number}</p>}</div> },
    { key: 'assigned_at', header: 'Assigned Date', render: (v) => formatDate(v) },
    // { key: 'days_active', header: 'Days Active', render: (_, row) => <span className="font-medium">{getDaysActive(row.assigned_at)}d</span> },
    {
      key: 'actions', header: '', width: '80px',
      render: (_, row) => (
        <Button variant="secondary" size="xs" onClick={(e) => { e.stopPropagation(); handleReturnClick(row) }}>
          Return
        </Button>
      )
    },
  ]

  const historyColumns = [
    { key: 'employee_name', header: 'Employee', render: (v, r) => <div><p className="font-medium">{v}</p>{r.employee_code && <p className="text-xs text-slate-400">{r.employee_code}</p>}</div> },
    { key: 'product_name', header: 'Asset', render: (_, r) => <div><p className="font-medium text-slate-800">{r.product_name || r.category_name}</p>{r.serial_number && <p className="font-mono text-xs text-slate-500">{r.serial_number}</p>}</div> },
    { key: 'assigned_at', header: 'Assigned', render: (v) => formatDate(v) },
    { key: 'returned_at', header: 'Returned', render: (v) => v ? formatDate(v) : <span className="text-indigo-600 text-xs font-medium">Active</span> },
    { key: 'return_condition', header: 'Condition', render: (v) => v ? <Badge status={v} /> : '—' },
    ...(isAdmin() ? [{
      key: 'actions', header: '', width: '60px',
      render: (_, row) => row.is_active ? null : (
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteClick(row) }}
          title="Delete record"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        </button>
      )
    }] : []),
  ]

  const activeItems = activeData?.data || []
  const historyItems = historyData?.data || []
  const activeMeta = activeData?.meta
  const historyMeta = historyData?.meta

  return (
    <div>
      <PageHeader
        title="Assignments"
        subtitle="Assign and return assets"
        actions={
          <Button onClick={assignModal.open} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}>
            Assign Asset
          </Button>
        }
      />

      <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-fit">
        {[{ id: 'active', label: 'Active Assignments' }, { id: 'history', label: 'History' }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1) }}
            className={['px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'].join(' ')}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search employee or asset..." className="w-full sm:w-72" />
      </div>

      {activeTab === 'active' ? (
        <>
          <DataTable columns={activeColumns} data={activeItems} isLoading={activeLoading} emptyMessage="No active assignments found" />
          {activeMeta?.totalPages > 1 && <div className="mt-4"><Pagination meta={activeMeta} onPageChange={setPage} /></div>}
        </>
      ) : (
        <>
          <DataTable columns={historyColumns} data={historyItems} isLoading={historyLoading} emptyMessage="No assignment history found" />
          {historyMeta?.totalPages > 1 && <div className="mt-4"><Pagination meta={historyMeta} onPageChange={setPage} /></div>}
        </>
      )}

      <AssignModal isOpen={assignModal.isOpen} onClose={assignModal.close} onSuccess={onMutationSuccess} />
      <ReturnModal isOpen={returnModal.isOpen} onClose={returnModal.close} assignment={selectedAssignment} onSuccess={onMutationSuccess} />
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => { deleteDialog.close(); setSelectedAssignment(null) }}
        onConfirm={() => selectedAssignment && deleteMutation.mutate(selectedAssignment.id)}
        title="Delete assignment record?"
        message={selectedAssignment ? `This will permanently remove the history entry for ${selectedAssignment.product_name || selectedAssignment.category_name} assigned to ${selectedAssignment.employee_name}. This action cannot be undone.` : ''}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

export default AssignmentsPage
