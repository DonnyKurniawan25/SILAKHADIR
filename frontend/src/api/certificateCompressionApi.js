import api from './axios'

// Snapshot includes ALL certificates in this event, not only the visible page.
export const startCertificateCompression = eventId =>
  api.post(`/events/${eventId}/certificates/compress-all/`, {})

// The server processes one certificate and returns cumulative persisted results.
export const stepCertificateCompression = (eventId, jobId, processed) =>
  api.post(`/events/${eventId}/certificates/compress-all/${jobId}/`, processed === undefined ? {} : { processed })
