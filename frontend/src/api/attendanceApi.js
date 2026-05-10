import api from './axios'

export const publicEventInfo = (slug) => api.get(`/public/events/${slug}/info/`)

export const submitAttendance = (slug, payload) =>
  api.post(`/public/events/${slug}/attendance/`, payload)
