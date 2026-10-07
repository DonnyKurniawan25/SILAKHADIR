export function certificateSearchParams(value, eventId) {
  const identity = String(value ?? '').trim()
  if (!/^(?:\d{16}|\d{18})$/.test(identity)) throw new Error('Masukkan salah satu: NIK 16 digit atau NIP 18 digit, hanya angka.')
  return { nik: identity, ...(eventId ? { event_id: eventId } : {}) }
}

// Only the public token route is safe for anonymous visitors. Never link pdf_url.
export function certificateDownloadUrl(certificate, apiBase = '/api') {
  const url = certificate.download_url
  if (typeof url === 'string' && /^(?:https?:\/\/[^/]+)?\/[^?#]*public\/certificates\/download\/[^/?#]+\/(?:\?[^#]*)?$/.test(url)) return url
  if (certificate.can_download && certificate.download_token) return `${apiBase.replace(/\/$/, '')}/public/certificates/download/${encodeURIComponent(certificate.download_token)}/`
  return null
}

export function certificateFilename(certificate) {
  const name = certificate.certificate_number || certificate.participant_name || 'Kegiatan'
  return `Sertifikat-${String(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 140) || 'Kegiatan'}.pdf`
}

export function certificateStatus(certificate) {
  const explicit = certificate.valid ?? certificate.is_verified ?? certificate.verified
  const verified = explicit === undefined ? certificate.status === 'tersedia' : explicit === true
  return { verified, label: verified ? 'Terverifikasi' : 'Belum terverifikasi' }
}

export function formatCertificateDates(start, end) {
  const format = value => {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const from = format(start)
  const to = format(end)
  return from ? `${from}${to && to !== from ? ` – ${to}` : ''}` : 'Tanggal belum tersedia'
}

export function saveCertificateBlob(blob, filename, browser = globalThis) {
  const url = browser.URL.createObjectURL(blob)
  const anchor = browser.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  browser.document.body.appendChild(anchor)
  try { anchor.click() } finally {
    anchor.remove()
    // Keep the object URL alive long enough for browsers to begin the download.
    browser.setTimeout(() => browser.URL.revokeObjectURL(url), 60000)
  }
}
