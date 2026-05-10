import api from './axios'

export const listEvents = (params) => api.get('/events/', { params })
export const getEvent = (id) => api.get(`/events/${id}/`)
export const createEvent = (data) => api.post('/events/', data)
export const updateEvent = (id, data) => api.put(`/events/${id}/`, data)
export const deleteEvent = (id) => api.delete(`/events/${id}/`)
export const getAttendanceLink = (id) => api.get(`/events/${id}/attendance-link/`)
export const closeEvent = (id) => api.post(`/events/${id}/close/`)
export const finishEvent = (id) => api.post(`/events/${id}/finish/`)

export const listParticipants = (eventId, params) =>
  api.get(`/events/${eventId}/participants/`, { params })
export const createParticipant = (eventId, data) =>
  api.post(`/events/${eventId}/participants/`, data)
export const updateParticipant = (id, data) => api.put(`/participants/${id}/`, data)
export const deleteParticipant = (id) => api.delete(`/participants/${id}/`)
export const importParticipants = (eventId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/events/${eventId}/participants/import-excel/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const exportParticipantsUrl = (eventId) =>
  `${api.defaults.baseURL}/events/${eventId}/participants/export-excel/`

export const dashboardStats = () => api.get('/dashboard/stats/')
