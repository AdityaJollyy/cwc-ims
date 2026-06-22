import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../../../api/dashboardApi'
import { consumableApi } from '../../../api/consumableApi'
import Card from '../../../components/ui/Card'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Loader'
import { formatDate, formatRelativeDate } from '../../../utils/formatters'

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, iconBg, sub, subIcon, onClick, accent }) => {
  const clickable = typeof onClick === 'function'
  return (
    <Card
      className={[
        'flex items-start gap-4 transition-all',
        clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : '',
        accent === 'danger' ? 'ring-1 ring-red-200' : '',
      ].join(' ')}
      padding="md"
      onClick={clickable ? onClick : undefined}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <p className={[
          'text-2xl font-bold leading-none',
          accent === 'danger' ? 'text-red-600' : 'text-slate-800',
        ].join(' ')}>
          {value ?? <span className="skeleton inline-block w-10 h-6 rounded" />}
        </p>
        {sub && (
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
            {subIcon}
            {sub}
          </p>
        )}
      </div>
    </Card>
  )
}

// ─── Skeleton Stat Card ───────────────────────────────────────────────────────
const StatCardSkeleton = () => (
  <Card className="flex items-start gap-4" padding="md">
    <div className="skeleton w-11 h-11 rounded-xl shrink-0" />
    <div className="flex-1">
      <div className="skeleton h-3 w-24 rounded mb-2" />
      <div className="skeleton h-7 w-16 rounded" />
    </div>
  </Card>
)

// ─── Activity Row ─────────────────────────────────────────────────────────────
const activityTypeConfig = {
  assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' },
  returned: { label: 'Returned', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
const DashboardPage = () => {
  const navigate = useNavigate()
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats().then(r => r.data.data),
  })

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => dashboardApi.getActivity().then(r => r.data.data),
  })

  const { data: consumables } = useQuery({
    queryKey: ['consumables-dashboard'],
    queryFn: () => consumableApi.getAll({ limit: 200 }).then(r => r.data.data),
  })

  const { data: maintenance, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['dashboard-maintenance-alerts'],
    queryFn: () => dashboardApi.getMaintenanceAlerts().then(r => r.data.data),
    enabled: maintenanceOpen,
  })

  // consumables comes back as the array directly (from r.data.data)
  const consumableList = Array.isArray(consumables) ? consumables : []
  const lowStockItems = consumableList.filter(
    (c) => c.current_stock <= (c.low_stock_threshold || 5) && c.current_stock > 0
  )
  const outOfStockItems = consumableList.filter(
    (c) => c.current_stock === 0
  )

  const statCards = [
    {
      label: 'Total Employees',
      value: stats?.totalEmployees,
      iconBg: 'bg-violet-100',
      icon: (
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      sub: stats ? `${stats.totalEmployees ?? 0} active` : null,
    },
    {
      label: 'Total Assets',
      value: stats?.totalAssets,
      iconBg: 'bg-blue-100',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        </svg>
      ),
      sub: stats ? `across ${stats.totalCategories ?? '—'} categories` : null,
    },
    {
      label: 'Available',
      value: stats?.availableAssets,
      iconBg: 'bg-emerald-100',
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      sub: 'Ready to assign',
    },
    {
      label: 'Assigned',
      value: stats?.assignedAssets,
      iconBg: 'bg-indigo-100',
      icon: (
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      sub: 'Currently in use',
    },
    {
      label: 'Damaged',
      value: stats?.damagedAssets,
      iconBg: 'bg-red-100',
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      sub: 'Needs attention',
    },
    {
      label: 'Under Repair',
      value: stats?.underRepairAssets,
      iconBg: 'bg-amber-100',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      sub: 'Being serviced',
    },
    {
      label: 'Needs Maintenance',
      value: stats?.needsMaintenance,
      iconBg: 'bg-red-100',
      accent: 'danger',
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 21l3.5-3.5m0 0L10 14m-3.5 3.5L3 14m3.5 3.5L10 21M14 3l7 7-3 3-7-7 3-3zM5 13l3-3 7 7-3 3-7-7z" />
        </svg>
      ),
      sub: stats
        ? `Older than ${stats.maintenanceAgeYears ?? 5} years`
        : null,
      onClick: stats?.needsMaintenance > 0 ? () => setMaintenanceOpen(true) : undefined,
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview of your inventory system</p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {statsLoading
          ? Array.from({ length: 7 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => <StatCard key={card.label} {...card} />)
        }
      </div>

      {/* Low Stock Alerts */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <Card padding="none" className="mb-6 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 border-b border-amber-100">
            <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">
              Stock Alerts — {outOfStockItems.length} out of stock, {lowStockItems.length} low stock
            </span>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {outOfStockItems.map((item) => (
              <span key={item.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {item.name} — Out of stock
              </span>
            ))}
            {lowStockItems.map((item) => (
              <span key={item.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {item.name} — {item.current_stock} left
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest assignment and return actions</p>
          </div>
        </div>        {activityLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="skeleton w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1">
                  <div className="skeleton h-3.5 w-48 rounded mb-1.5" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : !activity?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium text-slate-500">No recent activity</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(activity || []).slice(0, 10).map((item, i) => (
              <div key={item.id || i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                {/* Avatar */}
                <div className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  item.activity_type === 'returned' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700',
                ].join(' ')}>
                  {(item.employee_name || 'U')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.employee_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.product_name || item.category_name || 'Unknown asset'}
                    {item.serial_number ? ` · ${item.serial_number}` : ''}
                  </p>
                </div>

                {/* Badge + Date */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={[
                    'inline-flex items-center font-medium rounded-full text-xs px-2.5 py-0.5',
                    activityTypeConfig[item.activity_type]?.className || activityTypeConfig.assigned.className,
                  ].join(' ')}>
                    {activityTypeConfig[item.activity_type]?.label || 'Assigned'}
                  </span>
                  <span className="text-xs text-slate-400">{formatRelativeDate(item.assigned_at || item.returned_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Maintenance Alert Modal */}
      <Modal
        isOpen={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        title={`Assets Needing Maintenance${
          stats?.needsMaintenance != null ? ` (${stats.needsMaintenance})` : ''
        }`}
        size="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setMaintenanceOpen(false)}>
            Close
          </Button>
        }
      >
        <div>
          <div className="flex items-start gap-3 px-4 py-3 mb-4 bg-red-50 border border-red-100 rounded-lg">
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-red-800">
              These assets are older than{' '}
              <strong>{maintenance?.thresholdYears ?? stats?.maintenanceAgeYears ?? 5} years</strong>{' '}
              based on their purchase date (or date added, when no purchase date is set).
              Consider scheduling preventive maintenance or planning replacements.
            </div>
          </div>

          {maintenanceLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !maintenance?.assets?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <p className="text-sm">No assets need maintenance.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Product</th>
                    <th className="text-left font-medium px-3 py-2">Category</th>
                    <th className="text-left font-medium px-3 py-2">Serial / Asset No.</th>
                    <th className="text-left font-medium px-3 py-2">Purchase Date</th>
                    <th className="text-left font-medium px-3 py-2">Age</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maintenance.assets.map((a) => {
                    const refDate = a.purchase_date || a.created_at
                    const refMs = refDate ? new Date(refDate).getTime() : null
                    const ageYears = refMs
                      ? Math.floor((Date.now() - refMs) / (1000 * 60 * 60 * 24 * 365.25))
                      : null
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800 font-medium">
                          {a.product_name || <span className="text-slate-400">—</span>}
                          {a.model && <span className="text-xs text-slate-500 ml-1">({a.model})</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{a.category_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                          {a.serial_number || a.asset_number || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{formatDate(a.purchase_date)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 text-xs font-medium">
                            {ageYears != null ? `${ageYears} yr${ageYears === 1 ? '' : 's'}` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2"><Badge status={a.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex justify-end px-3 py-2 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setMaintenanceOpen(false)
                    navigate(`/assets?age_min=${maintenance?.thresholdYears ?? 5}`)
                  }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  View in Assets page →
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default DashboardPage
