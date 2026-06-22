import api from '../lib/axios'

export const employeeApi = {
  getAll:       (params) => api.get('/employees', { params }),
  getById:      (id)     => api.get(`/employees/${id}`),
  create:       (data)   => api.post('/employees', data),
  update:       (id, data) => api.put(`/employees/${id}`, data),
  archive:      (id)     => api.patch(`/employees/${id}/archive`),
  unarchive:    (id)     => api.patch(`/employees/${id}/unarchive`),
  delete:       (id)     => api.delete(`/employees/${id}`),
  getAssignments: (id)   => api.get(`/employees/${id}/assignments`),
  getHistory:   (id)     => api.get(`/employees/${id}/history`),
  getDivisions: ()       => api.get('/employees/meta/divisions'),
}
