import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetApi } from '../../../api/assetApi'
import { categoryApi } from '../../../api/categoryApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import SearchInput from '../../../components/ui/SearchInput'
import Select from '../../../components/ui/Select'
import DataTable from '../../../components/ui/DataTable'
import Pagination from '../../../components/ui/Pagination'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import AssetDetailDrawer from '../components/AssetDetailDrawer'
import AssetForm from '../components/AssetForm'
import { useToast } from '../../../store/ToastContext'
import { formatDate } from '../../../utils/formatters'
import useDisclosure from '../../../hooks/useDisclosure'

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'under_repair', label: 'Under Repair' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'retired', label: 'Retired' },
]

// Age buckets — value encodes age_min/age_max sent to the API.
//   any        → no age filter
//   exact-N    → age_min = age_max = N (the asset is between N and N+1 years old)
//   gte-N      → age_min = N (the asset is at least N years old)
const AGE_OPTIONS = [
  { value: 'any',     label: 'Any age' },
  { value: 'exact-0', label: 'Less than 1 year old' },
  { value: 'exact-1', label: '1 to 2 years old' },
  { value: 'exact-2', label: '2 to 3 years old' },
  { value: 'exact-3', label: '3 to 4 years old' },
  { value: 'exact-4', label: '4 to 5 years old' },
  { value: 'gte-5',   label: 'Over 5 years old (maintenance due)' },
]

const ageFilterToParams = (val) => {
  if (!val || val === 'any') return { age_min: undefined, age_max: undefined }
  if (val.startsWith('exact-')) {
    const n = parseInt(val.slice(6), 10)
    return Number.isFinite(n) ? { age_min: n, age_max: n } : { age_min: undefined, age_max: undefined }
  }
  if (val.startsWith('gte-')) {
    const n = parseInt(val.slice(4), 10)
    return Number.isFinite(n) ? { age_min: n, age_max: undefined } : { age_min: undefined, age_max: undefined }
  }
  return { age_min: undefined, age_max: undefined }
}

const AssetsPage = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const createModal = useDisclosure()
  const drawerDisclosure = useDisclosure()

  const [selectedAsset, setSelectedAsset] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    category_id: '',
    status: '',
    age: 'any',
    page: 1,
    limit: 25,
  })

  // Honor ?age_min=N from deep links (e.g. dashboard "View in Assets" link).
  // Maps to the matching AGE_OPTIONS bucket. Runs once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const ageMinParam = sp.get('age_min')
    if (ageMinParam == null) return
    const n = parseInt(ageMinParam, 10)
    if (Number.isFinite(n) && n >= 0) {
      const bucket = n >= 5 ? `gte-${n}` : `exact-${n}`
      if (AGE_OPTIONS.some(o => o.value === bucket)) {
        setFilters(f => ({ ...f, age: bucket, page: 1 }))
      }
    }
    // Strip the param so refresh/back doesn't re-apply unexpectedly.
    sp.delete('age_min')
    const newSearch = sp.toString()
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
    window.history.replaceState(null, '', newUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAll().then(r => r.data.data),
  })

  // Translate the age bucket to the api shape (age_min / age_max)
  // and drop the bucket key — the server doesn't know about it.
  const apiParams = (() => {
    const { age, ...rest } = filters
    return { ...rest, ...ageFilterToParams(age) }
  })()

  const { data, isLoading } = useQuery({
    queryKey: ['assets', apiParams],
    queryFn: () => assetApi.getAll(apiParams).then(r => r.data),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (formData) => assetApi.create(formData),
    onSuccess: () => {
      toast.success('Asset created successfully')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      createModal.close()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create asset'),
  })

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categoriesData || []).map(c => ({ value: c.id, label: c.name })),
  ]

  const columns = [
    { key: 'product_name', header: 'Product Name', render: (v) => v || <span className="text-slate-400">—</span> },
    { key: 'category_name', header: 'Category' },
    { key: 'model', header: 'Model', render: (v) => v || <span className="text-slate-400">—</span> },
    { key: 'serial_number', header: 'Serial No.', render: (v) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-slate-400">—</span> },
    { key: 'asset_number', header: 'Asset No.', render: (v) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-slate-400">—</span> },
    { key: 'status', header: 'Status', render: (v) => <Badge status={v} /> },
    {
      key: 'actions', header: '', width: '60px',
      render: (_, row) => (
        <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); handleViewAsset(row) }}>
          View
        </Button>
      )
    },
  ]

  const handleViewAsset = (asset) => {
    setSelectedAsset(asset)
    drawerDisclosure.open()
  }

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value, page: 1 }))

  const assets = data?.data || []
  const meta = data?.meta

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle={meta ? `${meta.total} assets total` : 'Manage all physical assets'}
        actions={
          <Button
            onClick={createModal.open}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
          >
            Add Asset
          </Button>
        }
      />

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter('status', tab.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              filters.status === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
          placeholder="Search by name, ID, serial..."
          className="w-full sm:w-72"
        />
        <Select
          value={filters.category_id}
          onChange={(e) => setFilter('category_id', e.target.value)}
          options={categoryOptions}
          placeholder="All Categories"
          className="w-full sm:w-48"
        />
        <Select
          value={filters.age}
          onChange={(e) => setFilter('age', e.target.value)}
          options={AGE_OPTIONS}
          placeholder=""
          className="w-full sm:w-56"
        />
        {filters.age && filters.age !== 'any' && (
          <button
            type="button"
            onClick={() => setFilter('age', 'any')}
            className="h-9 px-3 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Clear age filter
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={assets}
        isLoading={isLoading}
        onRowClick={handleViewAsset}
        emptyMessage="No assets found. Add your first asset to get started."
      />

      {meta && meta.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            meta={meta}
            onPageChange={(p) => setFilters(f => ({ ...f, page: p }))}
            onLimitChange={(l) => setFilters(f => ({ ...f, limit: l, page: 1 }))}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        title="Add Asset"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={createModal.close}>Cancel</Button>
            <Button form="asset-form" type="submit" loading={createMutation.isPending}>Save</Button>
          </>
        }
      >
        <AssetForm
          formId="asset-form"
          onSubmit={(data) => createMutation.mutate(data)}
        />
      </Modal>

      {/* Detail Drawer */}
      <AssetDetailDrawer
        isOpen={drawerDisclosure.isOpen}
        onClose={drawerDisclosure.close}
        asset={selectedAsset}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ['assets'] })}
      />
    </div>
  )
}

export default AssetsPage
