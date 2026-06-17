import api from '../lib/axios'

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: (params) => api.get('/dashboard/activity', { params }),
  getMaintenanceAlerts: () => api.get('/dashboard/maintenance-alerts'),
}
