import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../../../api/userApi'
import PageHeader from '../../../components/ui/PageHeader'
import Button from '../../../components/ui/Button'
import DataTable from '../../../components/ui/DataTable'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Card from '../../../components/ui/Card'
import Tabs from '../../../components/ui/Tabs'
import { useToast } from '../../../store/ToastContext'
import { useAuth } from '../../../store/AuthContext'
import { formatDateTime } from '../../../utils/formatters'
import useDisclosure from '../../../hooks/useDisclosure'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createUserSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['viewer', 'admin', 'super_admin']),
})

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

const SettingsPage = () => {
  const toast = useToast()
  const { user: currentUser, isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('users')
  const createModal = useDisclosure()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll().then(r => r.data.data),
    enabled: isSuperAdmin(),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'viewer' },
  })

  const createMutation = useMutation({
    mutationFn: (d) => userApi.create(d),
    onSuccess: () => { toast.success('User created successfully'); queryClient.invalidateQueries({ queryKey: ['users'] }); createModal.close(); reset() },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create user'),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }) => userApi.updateRole(id, role),
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries({ queryKey: ['users'] }) },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update role'),
  })

  const columns = [
    {
      key: 'full_name', header: 'User',
      render: (v, r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold shrink-0">
            {(v || r.email)?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-800">{v || '—'}</p>
            <p className="text-xs text-slate-400">{r.email}</p>
          </div>
        </div>
      )
    },
    { key: 'role', header: 'Role', render: (v) => <Badge status={v} /> },
    {
      key: 'role_action', header: 'Change Role', render: (_, r) => {
        if (r.id === currentUser?.id) return <span className="text-xs text-slate-400">Current user</span>
        return (
          <select
            defaultValue={r.role}
            onChange={(e) => updateRoleMutation.mutate({ id: r.id, role: e.target.value })}
            className="h-7 pl-2 pr-6 rounded-lg border border-slate-200 text-xs bg-white outline-none cursor-pointer appearance-none"
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
      }
    },
    { key: 'created_at', header: 'Created', render: v => <span className="text-xs text-slate-400">{formatDateTime(v)}</span> },
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage users, roles, and system configuration" />

      <Tabs
        tabs={[
          { id: 'users', label: 'User Management' },
          { id: 'about', label: 'About' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 'users' && (
        <div>
          {!isSuperAdmin() ? (
            <Card>
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600">Super Admin access required</p>
                <p className="text-xs text-slate-400 mt-1">Only Super Admins can manage users</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button onClick={createModal.open} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
                  Add User
                </Button>
              </div>
              <DataTable
                columns={columns}
                data={users || []}
                isLoading={isLoading}
                emptyMessage="No users found"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">System Information</h3>
            <div className="space-y-2">
              {[
                { label: 'Application', value: 'CWC Inventory Management' },
                { label: 'Version', value: '1.0.0' },
                { label: 'Database', value: 'Supabase PostgreSQL' },
                { label: 'Environment', value: 'Local Development' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 w-28 shrink-0">{item.label}</span>
                  <span className="text-sm text-slate-800 font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Modules</h3>
            <div className="grid grid-cols-2 gap-2">
              {['Employees', 'Assets', 'Categories', 'Dynamic Fields', 'Assignments', 'Consumables', 'Stock Management', 'Reports', 'Excel Export', 'Role Management'].map(mod => (
                <div key={mod} className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {mod}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Create User Modal */}
      <Modal isOpen={createModal.isOpen} onClose={() => { createModal.close(); reset() }} title="Create New User" size="sm"
        footer={<><Button variant="secondary" onClick={() => { createModal.close(); reset() }}>Cancel</Button><Button form="create-user" type="submit" loading={isSubmitting}>Create User</Button></>}
      >
        <form id="create-user" onSubmit={handleSubmit(d => createMutation.mutate(d))} className="flex flex-col gap-4">
          <Input label="Full Name" required error={errors.full_name?.message} placeholder="John Smith" {...register('full_name')} />
          <Input label="Email" type="email" required error={errors.email?.message} placeholder="john@company.com" {...register('email')} />
          <Input label="Password" type="password" required error={errors.password?.message} placeholder="Min 8 characters" {...register('password')} />
          <Select label="Role" required options={ROLE_OPTIONS} {...register('role')} />
        </form>
      </Modal>
    </div>
  )
}

export default SettingsPage
