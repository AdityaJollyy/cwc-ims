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
import SearchInput from '../../../components/ui/SearchInput'
import { useToast } from '../../../store/ToastContext'
import { formatDate, getDaysActive } from '../../../utils/formatters'
import useDisclosure from '../../../hooks/useDisclosure'

// ─── Assign Modal ─────────────────────────────────────────────
const AssignModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast()
  const [form, setForm] = useState({ employee_id: '', asset_id: '', serial_number: '', asset_number: '', remarks: '' })
  const [submitting, setSubmitting] = useState(false)

  const { data: employees } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => employeeApi.getAll({ is_archived: false, limit: 200 }).then(r => r.data.data),
    enabled: isOpen,
  })

  const { data: availableAssets } = useQuery({
    queryKey: ['assets-available'],
    queryFn: () => assetApi.getAll({ status: 'available', limit: 200 }).then(r => r.data.data),
    enabled: isOpen,
  })

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
        remarks: form.remarks || undefined,
      })
      toast.success('Asset assigned successfully')
      setForm({ employee_id: '', asset_id: '', serial_number: '', asset_number: '', remarks: '' })
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Employee <span className="text-red-500">*</span></label>
          <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className={inputCls}>
            <option value="">Select employee...</option>
            {(employees || []).map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Asset <span className="text-red-500">*</span></label>
          <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))} className={inputCls}>
            <option value="">Select available asset...</option>
            {(availableAssets || []).map(a => <option key={a.id} value={a.id}>{a.asset_id} — {a.product_name || a.category_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <p className="font-medium text-slate-800">{assignment.asset_code} — {assignment.product_name || assignment.category_name}</p>
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
  const assignModal = useDisclosure()
  const returnModal = useDisclosure()
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

  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['assignments-active'] })
    queryClient.invalidateQueries({ queryKey: ['assignments-history'] })
    queryClient.invalidateQueries({ queryKey: ['assets'] })
    queryClient.invalidateQueries({ queryKey: ['asset'] })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
    queryClient.invalidateQueries({ queryKey: ['employee'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const activeColumns = [
    { key: 'employee_name', header: 'Employee', render: (v, r) => <div><p className="font-medium text-slate-800">{v}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div> },
    { key: 'asset_code', header: 'Asset', render: (v, r) => <div><p className="font-mono text-xs font-medium text-indigo-600">{v}</p><p className="text-xs text-slate-500">{r.product_name || r.category_name}</p></div> },
    { key: 'assigned_at', header: 'Assigned Date', render: (v) => formatDate(v) },
    { key: 'days_active', header: 'Days Active', render: (_, row) => <span className="font-medium">{getDaysActive(row.assigned_at)}d</span> },
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
    { key: 'employee_name', header: 'Employee', render: (v, r) => <div><p className="font-medium">{v}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div> },
    { key: 'asset_code', header: 'Asset', render: (v, r) => <div><p className="font-mono text-xs font-medium text-indigo-600">{v}</p><p className="text-xs text-slate-500">{r.product_name || r.category_name}</p></div> },
    { key: 'assigned_at', header: 'Assigned', render: (v) => formatDate(v) },
    { key: 'returned_at', header: 'Returned', render: (v) => v ? formatDate(v) : <span className="text-indigo-600 text-xs font-medium">Active</span> },
    { key: 'return_condition', header: 'Condition', render: (v) => v ? <Badge status={v} /> : '—' },
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

      <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-xl p-1.5 w-fit shadow-sm">
        {[{ id: 'active', label: 'Active Assignments' }, { id: 'history', label: 'History' }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1) }}
            className={['px-4 py-1.5 rounded-lg text-sm font-medium transition-all', activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'].join(' ')}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search employee or asset..." className="w-72" />
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
    </div>
  )
}

export default AssignmentsPage
