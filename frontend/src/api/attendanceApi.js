import api from './axios'

export const publicEventInfo = (slug) => api.get(`/public/events/${slug}/info/`)

export const submitAttendance = (slug, payload) =>
  api.post(`/public/events/${slug}/attendance/`, payload)

export const lookupParticipant = (slug, payload) =>
  api.post(`/public/events/${slug}/participant-lookup/`, payload)
