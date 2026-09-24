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

export const getEventCertificateConfig = (eventId, config = {}) =>
  api.get(`/events/${eventId}/certificates/configure/`, config)

export const suggestEventCertificateLayout = (eventId, templateImage) => {
  const fd = new FormData()
  if (templateImage) fd.append('template_image', templateImage)
  return api.post(`/events/${eventId}/certificates/suggest-layout/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  })
}

export const configureEventCertificate = (eventId, { templateImage, signatureImage, certificateNumber, applyAll = false, layout = {} }) => {
  const fd = new FormData()
  if (templateImage) fd.append('template_image', templateImage)
  if (signatureImage) fd.append('signature_image', signatureImage)
  if (certificateNumber !== undefined && certificateNumber !== null) fd.append('certificate_number', certificateNumber)
  Object.entries(layout).forEach(([key, value]) => fd.append(key, String(value)))
  fd.append('apply_all', applyAll ? 'true' : 'false')
  return api.post(`/events/${eventId}/certificates/configure/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  })
}

export const setCertificateNumber = (eventId, certId, number) =>
  api.post(`/events/${eventId}/certificates/${certId}/set-number/`, { certificate_number: number })

export const generateEventCertificates = (eventId, { regenerate = false } = {}) =>
  api.post(`/events/${eventId}/certificates/generate/`, { regenerate })

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
