import { useState } from 'react'
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

const AssetsPage = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const createModal = useDisclosure()
  const drawerDisclosure = useDisclosure()

  const [selectedAsset, setSelectedAsset] = useState(null)
  const [filters, setFilters] = useState({ search: '', category_id: '', status: '', page: 1, limit: 25 })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAll().then(r => r.data.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['assets', filters],
    queryFn: () => assetApi.getAll(filters).then(r => r.data),
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
      <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1.5 w-fit shadow-sm">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter('status', tab.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
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
      <div className="flex gap-3 mb-5">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
          placeholder="Search by name, ID, serial..."
          className="w-72"
        />
        <Select
          value={filters.category_id}
          onChange={(e) => setFilter('category_id', e.target.value)}
          options={categoryOptions}
          placeholder="All Categories"
          className="w-48"
        />
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
