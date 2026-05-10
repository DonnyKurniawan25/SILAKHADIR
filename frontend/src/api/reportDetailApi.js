import api from './axios'

export const getEventReport = (eventId) =>
  api.get(`/events/${eventId}/report/`)

export const updateEventReport = (eventId, data) =>
  api.put(`/events/${eventId}/report/`, data)

// Foto
export const uploadReportPhotos = (eventId, files, captions = []) => {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  captions.forEach((c) => fd.append('captions', c))
  return api.post(`/events/${eventId}/report/photos/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const updateReportPhoto = (eventId, photoId, data) =>
  api.patch(`/events/${eventId}/report/photos/${photoId}/`, data)
export const deleteReportPhoto = (eventId, photoId) =>
  api.delete(`/events/${eventId}/report/photos/${photoId}/`)

// Link berita
export const addReportLink = (eventId, data) =>
  api.post(`/events/${eventId}/report/links/`, data)
export const updateReportLink = (eventId, linkId, data) =>
  api.put(`/events/${eventId}/report/links/${linkId}/`, data)
export const deleteReportLink = (eventId, linkId) =>
  api.delete(`/events/${eventId}/report/links/${linkId}/`)

// Lampiran bebas
export const addReportAttachment = (eventId, label, file) => {
  const fd = new FormData()
  fd.append('label', label || '')
  fd.append('file', file)
  return api.post(`/events/${eventId}/report/attachments/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const updateReportAttachment = (eventId, attId, data) =>
  api.patch(`/events/${eventId}/report/attachments/${attId}/`, data)
export const deleteReportAttachment = (eventId, attId) =>
  api.delete(`/events/${eventId}/report/attachments/${attId}/`)
