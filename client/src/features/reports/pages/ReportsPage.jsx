import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, exportApi, downloadBlob } from '../../../api/reportApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import DataTable from '../../../components/ui/DataTable'
import Badge from '../../../components/ui/Badge'
import Select from '../../../components/ui/Select'
import Card from '../../../components/ui/Card'
import Modal from '../../../components/ui/Modal'
import { PageLoader } from '../../../components/ui/Loader'
import { useToast } from '../../../store/ToastContext'
import { formatDate, formatDateTime } from '../../../utils/formatters'
import { categoryApi } from '../../../api/categoryApi'
import { consumableApi } from '../../../api/consumableApi'

const TABS = [
  { id: 'employees', label: 'Employee Assets' },
  // { id: 'categories', label: 'Category Breakdown' },
  { id: 'asset-status', label: 'Asset Status' },
  { id: 'assignment-history', label: 'Assignment History' },
  { id: 'stock', label: 'Bulk Inventory Stock' },
  { id: 'bulk-transactions', label: 'Bulk Inventory Transactions' },
  { id: 'damaged', label: 'Damaged Assets' },
]
  
// ─── Export Button ─────────────────────────────────────────────
const ExportButton = ({ onClick, loading }) => (
  <Button
    variant="secondary"
    size="sm"
    loading={loading}
    onClick={onClick}
    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
  >
    Export Excel
  </Button>
)

// ─── Employee Assets Tab ───────────────────────────────────────
const EmployeeAssetsTab = () => {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['report-employees'],
    queryFn: () => reportApi.getEmployeeAssets().then(r => r.data.data),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportApi.exportEmployees()
      downloadBlob(res.data, `employees-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const columns = [
    { key: 'employee_code', header: 'Employee Code', render: v => v ? <span className="font-mono text-xs font-medium text-indigo-600">{v}</span> : '—' },
    { key: 'name', header: 'Name', render: v => <span className="font-medium">{v}</span> },
    { key: 'division', header: 'Division', render: v => v || '—' },
    { key: 'designation', header: 'Designation', render: v => v || '—' },
    { key: 'assigned_count', header: 'Assets Assigned', render: v => <span className="font-semibold text-indigo-600">{v || 0}</span> },
    {
      key: 'assigned_assets', header: 'Assets',
      render: (v) => Array.isArray(v) && v.length
        ? <div className="flex flex-wrap gap-1">{v.slice(0, 3).map((a, i) => <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{a.product_name || a.category_name || 'Asset'}</span>)}{v.length > 3 && <span className="text-xs text-slate-400">+{v.length - 3}</span>}</div>
        : <span className="text-slate-400 text-xs">None</span>
    },
  ]

  return (
    <div>
      <div className="flex justify-end mb-4"><ExportButton onClick={handleExport} loading={exporting} /></div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No employee data found" />
    </div>
  )
}

// ─── Category Breakdown Tab ────────────────────────────────────
const CategoryBreakdownTab = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['report-categories'],
    queryFn: () => reportApi.getCategoryAssets().then(r => r.data.data),
  })

  const columns = [
    { key: 'name', header: 'Category', render: v => <span className="font-semibold">{v}</span> },
    { key: 'total', header: 'Total', render: v => <span className="font-bold text-slate-800">{v || 0}</span> },
    { key: 'available', header: 'Available', render: v => <span className="font-medium text-emerald-600">{v || 0}</span> },
    { key: 'assigned', header: 'Assigned', render: v => <span className="font-medium text-indigo-600">{v || 0}</span> },
    { key: 'damaged', header: 'Damaged', render: v => <span className="font-medium text-red-600">{v || 0}</span> },
    { key: 'under_repair', header: 'Under Repair', render: v => <span className="font-medium text-amber-600">{v || 0}</span> },
    { key: 'retired', header: 'Retired', render: v => <span className="font-medium text-slate-400">{v || 0}</span> },
  ]

  return <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No categories found" />
}

// ─── Asset Status Tab ──────────────────────────────────────────
const AssetStatusTab = () => {
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.getAll().then(r => r.data.data) })

  const { data, isLoading } = useQuery({
    queryKey: ['report-asset-status', statusFilter, categoryFilter],
    queryFn: () => reportApi.getAssetStatus({ status: statusFilter, category_id: categoryFilter }).then(r => r.data.data),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportApi.exportAssets()
      downloadBlob(res.data, `assets-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const columns = [
    { key: 'product_name', header: 'Product', render: v => v || '—' },
    { key: 'category_name', header: 'Category' },
    { key: 'serial_number', header: 'Serial No', render: v => v ? <span className="font-mono text-xs">{v}</span> : '—' },
    { key: 'asset_number', header: 'Asset No', render: v => v ? <span className="font-mono text-xs">{v}</span> : '—' },
    { key: 'status', header: 'Status', render: v => <Badge status={v} /> },
    { key: 'purchase_date', header: 'Purchased', render: v => formatDate(v) },
    { key: 'warranty_expiry', header: 'Warranty', render: (v) => {
      if (!v) return '—'
      const expired = new Date(v) < new Date()
      return <span className={expired ? 'text-red-500 text-xs font-medium' : ''}>{formatDate(v)} {expired ? '(Expired)' : ''}</span>
    }},
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
            { value: 'available', label: 'Available' }, { value: 'assigned', label: 'Assigned' },
            { value: 'under_repair', label: 'Under Repair' }, { value: 'damaged', label: 'Damaged' }, { value: 'retired', label: 'Retired' },
          ]} placeholder="All Statuses" className="w-full sm:w-44" />
          <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} options={(categories || []).map(c => ({ value: c.id, label: c.name }))} placeholder="All Categories" className="w-full sm:w-44" />
        </div>
        <ExportButton onClick={handleExport} loading={exporting} />
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No assets found" />
    </div>
  )
}

// ─── Assignment History Tab ────────────────────────────────────
const AssignmentHistoryTab = () => {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['report-assignment-history'],
    queryFn: () => reportApi.getAssignmentHistory().then(r => r.data.data),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportApi.exportAssignments()
      downloadBlob(res.data, `assignments-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const columns = [
    { key: 'employee_name', header: 'Employee', render: (v, r) => <div><p className="font-medium">{v}</p><p className="text-xs text-slate-400">{r.employee_code || '—'}</p></div> },
    { key: 'asset_id', header: 'Asset', render: (_, r) => <div><p className="font-medium text-slate-800">{r.product_name || r.category_name || '—'}</p>{r.serial_number && <p className="font-mono text-xs text-slate-500">{r.serial_number}</p>}</div> },
    { key: 'assigned_at', header: 'Assigned', render: v => formatDate(v) },
    { key: 'returned_at', header: 'Returned', render: v => v ? formatDate(v) : <span className="text-indigo-600 text-xs font-medium">Active</span> },
    { key: 'return_condition', header: 'Condition', render: v => v ? <Badge status={v} /> : '—' },
  ]

  return (
    <div>
      <div className="flex justify-end mb-4"><ExportButton onClick={handleExport} loading={exporting} /></div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No assignment history" />
    </div>
  )
}

// ─── Stock Report Tab ──────────────────────────────────────────
const StockReportTab = () => {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['report-stock'],
    queryFn: () => reportApi.getConsumableStock().then(r => r.data.data),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportApi.exportStock()
      downloadBlob(res.data, `stock-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const columns = [
    { key: 'name', header: 'Item Name', render: v => <span className="font-medium">{v}</span> },
    { key: 'category', header: 'Category', render: v => v || '—' },
    { key: 'unit', header: 'Unit', render: v => v || '—' },
    { key: 'current_stock', header: 'In Stock', render: v => <span className="font-medium">{v}</span> },
    { key: 'damaged_quantity', header: 'Damaged', render: v => <span className={v > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>{v}</span> },
    { key: 'current_stock', header: 'Available', render: (v, r) => {
      const avail = Math.max(0, v - r.damaged_quantity)
      return <span className={`font-bold ${avail < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{avail}{avail < 10 ? ' ⚠' : ''}</span>
    }},
  ]

  return (
    <div>
      <div className="flex justify-end mb-4"><ExportButton onClick={handleExport} loading={exporting} /></div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No items found" />
    </div>
  )
}

// ─── Bulk Inventory Transactions Tab ───────────────────────────
const TX_TYPE_OPTIONS = [
  { value: 'stock_in', label: 'Stock In' },
  { value: 'stock_out', label: 'Stock Out' },
  { value: 'damaged', label: 'Marked Damaged' },
  { value: 'issued', label: 'Issued' },
  { value: 'returned', label: 'Returned' },
]

const BulkInventoryTransactionsTab = () => {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [txType, setTxType] = useState('')
  const [consumableId, setConsumableId] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)

  const { data: consumables } = useQuery({
    queryKey: ['consumables-all-for-reports'],
    queryFn: () => consumableApi.getAll({ limit: 500 }).then(r => r.data.data),
  })

  const filters = {
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    transaction_type: txType || undefined,
    consumable_id: consumableId || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['report-bulk-inventory-transactions', filters],
    queryFn: () => reportApi.getBulkInventoryTransactions(filters).then(r => r.data.data),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportApi.exportBulkInventoryTransactions(filters)
      downloadBlob(res.data, `bulk-inventory-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const inputCls = 'h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white'

  const columns = [
    { key: 'created_at', header: 'Date', render: v => <span className="text-xs text-slate-600 whitespace-nowrap">{formatDateTime(v)}</span> },
    {
      key: 'consumable_name', header: 'Item',
      render: (v, r) => <div><p className="font-medium text-slate-800">{v}</p>{r.consumable_category && <p className="text-xs text-slate-500">{r.consumable_category}</p>}</div>,
    },
    { key: 'transaction_type', header: 'Type', render: v => <Badge status={v} /> },
    {
      key: 'quantity', header: 'Qty',
      render: (v, r) => {
        const sign = r.transaction_type === 'stock_in' || r.transaction_type === 'returned'
          ? '+'
          : r.transaction_type === 'damaged'
            ? '⚠'
            : '-'
        return <span className="font-semibold text-slate-800">{sign}{v} {r.consumable_unit || ''}</span>
      },
    },
    {
      key: 'employee_name', header: 'Employee',
      render: (v, r) => v
        ? <div><p className="font-medium text-sm">{v}</p>{r.employee_code && <p className="text-xs text-slate-400">{r.employee_code}</p>}</div>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    { key: 'reference', header: 'Reference', render: v => v || <span className="text-slate-400 text-xs">—</span> },
    {
      key: 'remarks', header: 'Remarks',
      render: v => v
        ? <span className="text-xs text-slate-600 line-clamp-2 max-w-xs block">{v}</span>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    { key: 'performed_by_name', header: 'By', render: v => v || <span className="text-slate-400 text-xs">—</span> },
  ]

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 gap-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputCls} />
          </div>
          <Select value={txType} onChange={e => setTxType(e.target.value)} options={TX_TYPE_OPTIONS} placeholder="All Types" className="w-full sm:w-40" />
          <Select value={consumableId} onChange={e => setConsumableId(e.target.value)}
            options={(consumables || []).map(c => ({ value: c.id, label: c.name }))}
            placeholder="All Items" className="w-full sm:w-52" />
          {(fromDate || toDate || txType || consumableId) && (
            <Button variant="secondary" size="sm" onClick={() => { setFromDate(''); setToDate(''); setTxType(''); setConsumableId('') }}>
              Clear
            </Button>
          )}
        </div>
        <ExportButton onClick={handleExport} loading={exporting} />
      </div>

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        emptyMessage="No transactions found"
        onRowClick={(row) => setSelectedTx(row)}
      />

      <BulkInventoryTransactionDetailModal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
      />
    </div>
  )
}

const TX_LABELS = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  damaged: 'Marked Damaged',
  issued: 'Issued',
  returned: 'Returned',
}

const BulkInventoryTransactionDetailModal = ({ isOpen, onClose, transaction }) => {
  if (!transaction) return null

  const sign = transaction.transaction_type === 'stock_in' || transaction.transaction_type === 'returned'
    ? '+'
    : transaction.transaction_type === 'damaged'
      ? '⚠'
      : '-'

  const rows = [
    { label: 'Type', value: <Badge status={transaction.transaction_type} /> },
    { label: 'Item', value: <span className="font-medium">{transaction.consumable_name}{transaction.consumable_category ? ` · ${transaction.consumable_category}` : ''}</span> },
    { label: 'Quantity', value: <span className="font-semibold text-slate-800">{sign}{transaction.quantity} {transaction.consumable_unit || ''}</span> },
    { label: 'Date of Issue', value: formatDateTime(transaction.created_at) },
    transaction.employee_name ? { label: 'Employee', value: `${transaction.employee_name}${transaction.employee_code ? ` (${transaction.employee_code})` : ''}${transaction.employee_division ? ` — ${transaction.employee_division}` : ''}` } : null,
    transaction.reference ? { label: 'Reference', value: transaction.reference } : null,
    transaction.performed_by_name ? { label: 'Performed By', value: transaction.performed_by_name } : null,
  ].filter(Boolean)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Transaction — ${TX_LABELS[transaction.transaction_type] || transaction.transaction_type}`}
      size="md"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col">
        {rows.map(r => (
          <div key={r.label} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-xs text-slate-500 w-32 shrink-0 pt-0.5">{r.label}</span>
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

// ─── Damaged Assets Tab ────────────────────────────────────────
const DamagedAssetsTab = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['report-damaged'],
    queryFn: () => reportApi.getDamagedAssets().then(r => r.data.data),
  })

  const columns = [
    { key: 'product_name', header: 'Product', render: v => v || '—' },
    { key: 'category_name', header: 'Category' },
    { key: 'model', header: 'Model', render: v => v || '—' },
    { key: 'serial_number', header: 'Serial No', render: v => v ? <span className="font-mono text-xs">{v}</span> : '—' },
    { key: 'last_assigned_to', header: 'Last Assigned To', render: v => v || '—' },
    { key: 'updated_at', header: 'Date Damaged', render: v => formatDate(v) },
  ]

  return <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No damaged assets 🎉" />
}

// ─── Main Page ─────────────────────────────────────────────────
const TAB_COMPONENTS = {
  'employees': EmployeeAssetsTab,
  'categories': CategoryBreakdownTab,
  'asset-status': AssetStatusTab,
  'assignment-history': AssignmentHistoryTab,
  'stock': StockReportTab,
  'bulk-transactions': BulkInventoryTransactionsTab,
  'damaged': DamagedAssetsTab,
}

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('employees')
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div>
      <PageHeader title="Reports" subtitle="View and export comprehensive inventory reports" />

      <div className="flex gap-1 flex-nowrap sm:flex-wrap mb-6 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={['px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <ActiveComponent />
      </Card>
    </div>
  )
}

export default ReportsPage
