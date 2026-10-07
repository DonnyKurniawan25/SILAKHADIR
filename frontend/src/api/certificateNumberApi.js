import api from './axios'

// No certificate_id means every certificate in the event, including other pages.
export const updateEventCertificateNumber = (eventId, payload) =>
  api.post(`/events/${eventId}/certificates/number/`, payload)

// Read-only preview: candidates require an explicit individual save afterwards.
export const detectEventCertificateNumbers = (eventId) =>
  api.post(`/events/${eventId}/certificates/detect-numbers/`, {})
