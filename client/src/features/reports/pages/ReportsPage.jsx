import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, exportApi, downloadBlob } from '../../../api/reportApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import DataTable from '../../../components/ui/DataTable'
import Badge from '../../../components/ui/Badge'
import Select from '../../../components/ui/Select'
import Card from '../../../components/ui/Card'
import { PageLoader } from '../../../components/ui/Loader'
import { useToast } from '../../../store/ToastContext'
import { formatDate } from '../../../utils/formatters'
import { categoryApi } from '../../../api/categoryApi'

const TABS = [
  { id: 'employees', label: 'Employee Assets' },
  { id: 'categories', label: 'Category Breakdown' },
  { id: 'asset-status', label: 'Asset Status' },
  { id: 'assignment-history', label: 'Assignment History' },
  { id: 'stock', label: 'Bulk Inventory Stock' },
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
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex gap-3">
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
            { value: 'available', label: 'Available' }, { value: 'assigned', label: 'Assigned' },
            { value: 'under_repair', label: 'Under Repair' }, { value: 'damaged', label: 'Damaged' }, { value: 'retired', label: 'Retired' },
          ]} placeholder="All Statuses" className="w-44" />
          <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} options={(categories || []).map(c => ({ value: c.id, label: c.name }))} placeholder="All Categories" className="w-44" />
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
  'damaged': DamagedAssetsTab,
}

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('employees')
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div>
      <PageHeader title="Reports" subtitle="View and export comprehensive inventory reports" />

      <div className="flex gap-1 flex-wrap mb-6 bg-white border border-slate-200 rounded-xl p-1.5 w-fit shadow-sm">
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
