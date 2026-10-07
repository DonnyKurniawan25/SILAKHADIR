import { updateCertificateReview } from './certificateReview.mjs'

export function certificateNumberError(value) {
  if (/[\x00-\x1f\x7f]/.test(String(value ?? ''))) return 'Nomor sertifikat harus satu baris tanpa karakter kontrol.'
  return String(value ?? '').length > 100 ? 'Nomor sertifikat maksimal 100 karakter.' : ''
}

export function certificateNumberPayload(value, certificateId) {
  const error = certificateNumberError(value)
  if (error) throw new Error(error)
  return { certificate_number: String(value ?? '').trim(), ...(certificateId != null && certificateId !== '' ? { certificate_id: certificateId } : {}) }
}

// Existing review helper intentionally invalidates a row; call it only for changes.
export function updateCertificateNumber(items, id, value) {
  const row = items.find(item => item.id === id)
  return !row || row.certificate_number === value ? items : updateCertificateReview(items, id, 'certificate_number', value)
}

export function applyCertificateNumberMode(items, mode, commonNumber = '') {
  return items.reduce((current, item) => updateCertificateNumber(current, item.id,
    mode === 'same' ? String(commonNumber) : String(item.detected_number ?? item.certificate_number ?? '')), items)
}

export function detectedNumberCandidates(items) {
  return items.map(item => {
    const candidate = String(item.detected_number ?? '').trim()
    return { ...item, candidate, found: Boolean(candidate) }
  })
}
