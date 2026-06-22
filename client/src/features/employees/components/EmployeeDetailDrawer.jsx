import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeApi } from '../../../api/employeeApi'
import Drawer from '../../../components/ui/Drawer'
import Tabs from '../../../components/ui/Tabs'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import DataTable from '../../../components/ui/DataTable'
import { Spinner } from '../../../components/ui/Loader'
import { formatDate } from '../../../utils/formatters'
import EmployeeForm from './EmployeeForm'
import MakeAndAssignAssetModal from './MakeAndAssignAssetModal'
import { useToast } from '../../../store/ToastContext'

const InfoRow = ({ label, value }) => (
  <div className="flex gap-2 py-2.5 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-500 w-36 shrink-0">{label}</span>
    <span className="text-sm text-slate-800 font-medium">{value ?? '—'}</span>
  </div>
)

const EmployeeDetailDrawer = ({ employee, isOpen, onClose, onUpdate }) => {
  const [tab, setTab] = useState('details')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [makeAssignOpen, setMakeAssignOpen] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['employee-assignments', employee?.id],
    queryFn: () => employeeApi.getAssignments(employee.id).then(r => r.data.data),
    enabled: isOpen && !!employee?.id && tab === 'equipment',
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['employee-history', employee?.id],
    queryFn: () => employeeApi.getHistory(employee.id).then(r => r.data.data),
    enabled: isOpen && !!employee?.id && tab === 'history',
  })

  const updateMutation = useMutation({
    mutationFn: (data) => employeeApi.update(employee.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setEditOpen(false)
      toast.success('Employee updated successfully')
      onUpdate?.()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update employee'),
  })

  const archiveMutation = useMutation({
    mutationFn: () => employeeApi.archive(employee.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee archived successfully')
      onUpdate?.()
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to archive employee'),
  })

  const unarchiveMutation = useMutation({
    mutationFn: () => employeeApi.unarchive(employee.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee unarchived successfully')
      onUpdate?.()
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to unarchive employee'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => employeeApi.delete(employee.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setDeleteOpen(false)
      toast.success('Employee deleted permanently')
      onClose()
    },
    onError: (err) => {
      setDeleteOpen(false)
      toast.error(err.response?.data?.message || 'Failed to delete employee')
    },
  })

  if (!employee) return null

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'history', label: 'History' },
  ]

  // Backend returns assigned_at and returned_at (not assigned_date / returned_date)
  const equipmentColumns = [
    { key: 'product_name', header: 'Product', render: (v) => v || '—' },
    { key: 'category_name', header: 'Category', render: (v) => v || '—' },
    { key: 'serial_number', header: 'Serial No', render: (v) => v ? <span className="font-mono text-xs">{v}</span> : '—' },
    { key: 'assigned_at', header: 'Assigned', render: (v) => formatDate(v) },
  ]

  const historyColumns = [
    { key: 'product_name', header: 'Product', render: (v) => v || '—' },
    { key: 'category_name', header: 'Category', render: (v) => v || '—' },
    { key: 'assigned_at', header: 'Assigned', render: (v) => formatDate(v) },
    {
      key: 'returned_at', header: 'Returned',
      render: (v) => v ? formatDate(v) : <span className="text-indigo-600 font-medium text-xs">Active</span>,
    },
    {
      key: 'return_condition', header: 'Condition',
      render: (v) => v ? <Badge status={v} /> : '—',
    },
  ]

  const hasActiveAssignments = parseInt(employee.assigned_count || 0, 10) > 0

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Employee Details"
        width="max-w-xl"
        footer={
          <>
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
            <div className="flex gap-2 flex-wrap justify-end">
              {employee.is_archived ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={unarchiveMutation.isPending}
                  onClick={() => unarchiveMutation.mutate()}
                >
                  Unarchive
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={hasActiveAssignments}
                  title={hasActiveAssignments ? `Return ${employee.assigned_count} asset(s) before archiving` : 'Archive employee'}
                  loading={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate()}
                >
                  Archive
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMakeAssignOpen(true)}
                disabled={!!employee.is_archived}
                title={employee.is_archived ? 'Cannot assign assets to an archived employee' : 'Create a new asset and assign it directly'}
              >
                🖥️ Create &amp; Assign
              </Button>
              <Button size="sm" onClick={() => setEditOpen(true)}>
                Edit Employee
              </Button>
            </div>
          </>
        }
      >
        {/* Employee header */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold">
            {employee.name?.[0]?.toUpperCase() || 'E'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-800">{employee.name}</h3>
              {hasActiveAssignments && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium ring-1 ring-blue-200">
                  {employee.assigned_count} assigned
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {employee.designation || '—'} {employee.division ? `· ${employee.division}` : ''}
            </p>
            {employee.employee_code && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{employee.employee_code}</p>
            )}
          </div>
        </div>

        <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-4" />

        {/* Details tab */}
        {tab === 'details' && (
          <div>
            <InfoRow label="Employee Code" value={employee.employee_code} />
            <InfoRow label="Full Name" value={employee.name} />
            <InfoRow label="Division" value={employee.division} />
            <InfoRow label="Designation" value={employee.designation} />
            <InfoRow label="Mobile" value={employee.mobile} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Added On" value={formatDate(employee.created_at)} />
            {employee.remarks && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Remarks</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5">{employee.remarks}</p>
              </div>
            )}
          </div>
        )}

        {/* Equipment tab */}
        {tab === 'equipment' && (
          <div>
            {assignmentsLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <DataTable
                columns={equipmentColumns}
                data={assignments || []}
                emptyMessage="No equipment currently assigned"
              />
            )}
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div>
            {historyLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <DataTable
                columns={historyColumns}
                data={history || []}
                emptyMessage="No assignment history found"
              />
            )}
          </div>
        )}
      </Drawer>

      {/* ─── Edit Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Employee"
        size="lg"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
            <button
              form="employee-edit-form"
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <EmployeeForm
          formId="employee-edit-form"
          isEdit
          defaultValues={{
            employee_code: employee.employee_code || '',
            name: employee.name || '',
            division: employee.division || '',
            designation: employee.designation || '',
            mobile: employee.mobile || '',
            email: employee.email || '',
            remarks: employee.remarks || '',
          }}
          onSubmit={(data) => updateMutation.mutate(data)}
        />
      </Modal>

      {/* ─── Delete Confirm ──────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete "${employee.name}"?`}
        message={
          hasActiveAssignments
            ? `⚠️ ${employee.name} has ${employee.assigned_count} asset(s) currently assigned. Please return all assets before deleting.`
            : `This will permanently delete ${employee.name} and all their assignment history. This action cannot be undone.`
        }
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        confirmDisabled={hasActiveAssignments}
      />

      {/* ─── Make & Assign Asset Modal ───────────────────────────── */}
      <MakeAndAssignAssetModal
        isOpen={makeAssignOpen}
        onClose={() => setMakeAssignOpen(false)}
        employee={employee}
        onSuccess={() => {
          onUpdate?.()
          setTab('equipment')
        }}
      />
    </>
  )
}

export default EmployeeDetailDrawer
