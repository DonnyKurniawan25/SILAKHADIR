import api from './axios'

export const verifyEventCertificate = (eventId, certificateId) =>
  api.post(`/events/${eventId}/certificates/${certificateId}/verify/`, {})

export const cancelEventCertificateVerification = (eventId, certificateId) =>
  api.post(`/events/${eventId}/certificates/${certificateId}/cancel-verification/`, {})

// Omitted IDs deliberately targets the entire event, not just the displayed page.
export const verifyAllEventCertificates = (eventId) =>
  api.post(`/events/${eventId}/certificates/verify-all/`, {})

export const cancelAllEventCertificateVerifications = (eventId) =>
  api.post(`/events/${eventId}/certificates/cancel-verification-all/`, {})

export function certificateVerificationError(error, fallback = 'Perubahan verifikasi gagal. Coba kembali.') {
  const data = error?.response?.data
  const detail = typeof data?.detail === 'string' ? data.detail : ''
  const reasons = Array.isArray(data?.errors) ? data.errors.flatMap((row) => Array.isArray(row.errors) ? row.errors.filter((reason) => typeof reason === 'string') : []) : []
  const messages = [...new Set([detail, ...reasons].filter(Boolean))]
  if (messages.length) return messages.join(' ')
  if (error?.response?.status === 401) return 'Sesi masuk berakhir. Silakan masuk kembali.'
  if (error?.response?.status === 403) return 'Anda tidak memiliki izin untuk mengubah verifikasi sertifikat.'
  return fallback
}

export function certificateStatus(cert) {
  const verified = cert.status === 'tersedia'
  const processing = cert.status === 'diproses'
  return {
    verified,
    canVerify: processing && Boolean(cert.pdf_url),
    label: verified ? 'Tersedia / terverifikasi' : processing ? 'Diproses / belum diverifikasi' : cert.status === 'dicabut' ? 'Dicabut' : (cert.status || 'Belum tersedia'),
    badge: verified ? 'badge-green' : 'badge-yellow',
  }
}
