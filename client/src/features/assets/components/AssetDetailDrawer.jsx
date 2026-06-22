import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetApi } from '../../../api/assetApi'
import { categoryApi } from '../../../api/categoryApi'
import Drawer from '../../../components/ui/Drawer'
import Tabs from '../../../components/ui/Tabs'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Select from '../../../components/ui/Select'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { Spinner } from '../../../components/ui/Loader'
import { formatDate } from '../../../utils/formatters'
import AssetForm from './AssetForm'
import { useToast } from '../../../store/ToastContext'

const InfoRow = ({ label, value }) => (
  <div className="flex gap-2 py-2.5 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-500 w-36 shrink-0">{label}</span>
    <span className="text-sm text-slate-800 font-medium break-all">{value ?? '—'}</span>
  </div>
)

// Statuses that can be set manually (not 'assigned' — that's set by the assignment module)
const STATUS_OPTIONS = [
  { value: 'available',   label: 'Available' },
  { value: 'under_repair', label: 'Under Repair' },
  { value: 'damaged',     label: 'Damaged' },
  { value: 'retired',     label: 'Retired' },
]

const AssetDetailDrawer = ({ asset, isOpen, onClose, onUpdated }) => {
  const [tab, setTab] = useState('details')
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch full asset detail (includes current assignment info)
  const { data: assetDetail, isLoading } = useQuery({
    queryKey: ['asset', asset?.id],
    queryFn: () => assetApi.getById(asset.id).then(r => r.data.data),
    enabled: isOpen && !!asset?.id,
  })

  const detail = assetDetail || asset

  // Category field metadata — for labels + types when rendering custom values
  const { data: categoryFields } = useQuery({
    queryKey: ['category-fields', detail?.category_id],
    queryFn: () => categoryApi.getFields(detail.category_id).then(r => r.data.data),
    enabled: isOpen && !!detail?.category_id,
  })

  const updateMutation = useMutation({
    mutationFn: (data) => assetApi.update(detail.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', detail?.id] })
      setEditOpen(false)
      onUpdated?.()
      toast.success('Asset updated successfully')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update asset'),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => assetApi.updateStatus(detail.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', detail?.id] })
      setStatusOpen(false)
      setNewStatus('')
      onUpdated?.()
      toast.success('Asset status updated')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status'),
  })
  const deleteMutation = useMutation({
    mutationFn: () => assetApi.delete(detail.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setDeleteOpen(false)
      onUpdated?.()
      onClose()
      toast.success('Asset deleted permanently')
    },
    onError: (err) => {
      setDeleteOpen(false)
      toast.error(err.response?.data?.message || 'Failed to delete asset')
    },
  })


  if (!asset) return null

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'assignment', label: 'Assignment' },
  ]

  const isAssigned = detail?.status === 'assigned'
  const customFields = detail?.custom_fields || {}

  // Build ordered list of custom field rows, using category metadata for label + type
  const fieldMeta = categoryFields || []
  const metaByName = Object.fromEntries(fieldMeta.map(f => [f.field_name, f]))
  const orderedKeys = [
    ...fieldMeta.map(f => f.field_name).filter(k => k in customFields),
    ...Object.keys(customFields).filter(k => !(k in metaByName)),
  ]
  const customRows = orderedKeys
    .map(key => ({ key, value: customFields[key], meta: metaByName[key] }))
    .filter(({ value }) => value !== '' && value !== null && value !== undefined)

  const formatCustomValue = (value, meta) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (meta?.field_type === 'boolean') return value ? 'Yes' : 'No'
    return String(value ?? '—')
  }

  const labelFor = (key, meta) =>
    meta?.field_label ||
    key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  // Status options filtered: don't show current status; if assigned, show nothing (can't change)
  const availableStatusOptions = STATUS_OPTIONS.filter(s => s.value !== detail?.status)

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Asset Details"
        width="max-w-xl"
        footer={
          <>
            <Button
              variant="danger-ghost"
              size="sm"
              disabled={isAssigned}
              title={isAssigned ? 'Return asset before deleting' : 'Delete asset permanently'}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={isAssigned}
                title={isAssigned ? 'Return the asset before changing status' : 'Change status'}
                onClick={() => { setNewStatus(''); setStatusOpen(true) }}
              >
                Change Status
              </Button>
              <Button size="sm" onClick={() => setEditOpen(true)}>
                Edit Asset
              </Button>
            </div>
          </>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <>
            {/* Asset header */}
            <div className="flex items-start gap-4 mb-5 pb-5 border-b border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-slate-800">
                    {detail?.product_name || 'Unnamed Asset'}
                  </h3>
                  <Badge status={detail?.status} />
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{detail?.category_name || '—'}</p>
              </div>
            </div>

            <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-4" />

            {/* Details tab */}
            {tab === 'details' && (
              <div>
                <InfoRow label="Product Name" value={detail?.product_name} />
                <InfoRow label="Category" value={detail?.category_name} />
                <InfoRow label="Model" value={detail?.model} />
                <InfoRow label="Serial Number" value={detail?.serial_number} />
                <InfoRow label="Asset Number" value={detail?.asset_number} />
                <InfoRow label="Status" value={<Badge status={detail?.status} />} />
                <InfoRow label="Purchase Date" value={formatDate(detail?.purchase_date)} />
                <InfoRow label="Warranty Expiry" value={formatDate(detail?.warranty_expiry)} />
                <InfoRow label="Added On" value={formatDate(detail?.created_at)} />

                {customRows.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-5 mb-1">
                      {detail?.category_name ? `${detail.category_name} Fields` : 'Additional Fields'}
                    </p>
                    {customRows.map(({ key, value, meta }) => (
                      <InfoRow
                        key={key}
                        label={labelFor(key, meta)}
                        value={formatCustomValue(value, meta)}
                      />
                    ))}
                  </>
                )}

                {detail?.remarks && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Remarks</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5">{detail.remarks}</p>
                  </div>
                )}
              </div>
            )}

            {/* Assignment tab */}
            {tab === 'assignment' && (
              <div>
                {isAssigned && detail?.assigned_to_name ? (
                  <div>
                    <div className="bg-indigo-50 rounded-xl p-4 mb-4 border border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Currently Assigned To</p>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                          {detail.assigned_to_name?.[0]?.toUpperCase() || 'E'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{detail.assigned_to_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{detail.assigned_to_employee_code || '—'}</p>
                          {detail.assigned_at && (
                            <p className="text-xs text-slate-400 mt-0.5">Since {formatDate(detail.assigned_at)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <InfoRow label="Employee" value={detail.assigned_to_name} />
                    <InfoRow label="Employee Code" value={detail.assigned_to_employee_code} />
                    <InfoRow label="Designation" value={detail.assigned_to_designation} />
                    <InfoRow label="Assigned At" value={formatDate(detail.assigned_at)} />
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                      To return this asset, go to the <strong>Assignments</strong> page and click <strong>Return</strong>.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-sm text-slate-500">Not currently assigned</p>
                    {detail?.status !== 'available' && (
                      <p className="text-xs text-slate-400 mt-1">
                        Status is <strong>{detail?.status?.replace('_', ' ')}</strong> — change to Available before assigning
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ─── Edit Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Asset"
        size="lg"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
            <button
              form="asset-edit-form"
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <AssetForm
          formId="asset-edit-form"
          isEdit
          defaultValues={{
            category_id: String(detail?.category_id || ''),
            product_name: detail?.product_name || '',
            model: detail?.model || '',
            serial_number: detail?.serial_number || '',
            asset_number: detail?.asset_number || '',
            purchase_date: detail?.purchase_date?.split('T')[0] || '',
            warranty_expiry: detail?.warranty_expiry?.split('T')[0] || '',
            remarks: detail?.remarks || '',
            custom_fields: detail?.custom_fields || {},
          }}
          onSubmit={(data) => {
            updateMutation.mutate(data)
          }}
        />
      </Modal>

      {/* ─── Change Status Modal ─────────────────────────────────── */}
      <Modal
        isOpen={statusOpen}
        onClose={() => { setStatusOpen(false); setNewStatus('') }}
        title="Change Asset Status"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setStatusOpen(false); setNewStatus('') }}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={statusMutation.isPending}
              disabled={!newStatus || newStatus === detail?.status}
              onClick={() => statusMutation.mutate(newStatus)}
            >
              Update Status
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Current status:</span>
            <Badge status={detail?.status} />
          </div>

          {isAssigned ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
              ⚠️ This asset is currently assigned. Return it first before changing its status.
            </p>
          ) : (
            <>
              {detail?.status === 'damaged' && (
                <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
                  💡 You can set a damaged asset back to <strong>Available</strong> after repair.
                </p>
              )}
              <Select
                label="New Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                options={availableStatusOptions}
                placeholder="Select new status..."
              />
            </>
          )}
        </div>
      </Modal>

      {/* ─── Delete Confirm ──────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        confirmDisabled={isAssigned}
        title={`Delete "${detail?.product_name || 'this asset'}"?`}
        message={
          isAssigned
            ? `⚠️ This asset is currently assigned. Please return it before deleting.`
            : `This will permanently delete ${detail?.product_name || 'this asset'} and all its assignment history. This action cannot be undone.`
        }
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </>
  )
}

export default AssetDetailDrawer
