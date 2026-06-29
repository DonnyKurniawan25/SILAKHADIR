import api from './axios'

export const listCertificates = (params) => api.get('/certificates/', { params })

export const listEventCertificates = (eventId) =>
  api.get(`/events/${eventId}/certificates/`)

export const uploadCertificate = (eventId, { participantId, pdfFile, certificateNumber, newParticipant }) => {
  const fd = new FormData()
  fd.append('pdf_file', pdfFile)
  fd.append('certificate_number', certificateNumber)
  if (participantId) {
    fd.append('participant_id', participantId)
  } else if (newParticipant) {
    Object.entries(newParticipant).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v)
    })
  }
  return api.post(`/events/${eventId}/certificates/upload/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const bulkUploadCertificates = (eventId, { files, dryRun = false, createMissing = false }) => {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  fd.append('dry_run', dryRun ? 'true' : 'false')
  fd.append('create_missing', createMissing ? 'true' : 'false')
  return api.post(`/events/${eventId}/certificates/bulk-upload/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  })
}

export const replaceCertificateFile = (eventId, certId, pdfFile) => {
  const fd = new FormData()
  fd.append('pdf_file', pdfFile)
  return api.post(`/events/${eventId}/certificates/${certId}/replace-file/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const checkCertificate = (nik, eventId) => {
  const params = { nik }
  if (eventId) params.event_id = eventId
  return api.get('/public/certificates/check/', { params })
}

export const verifyCertificate = (token) =>
  api.get(`/public/certificates/verify/${token}/`)
