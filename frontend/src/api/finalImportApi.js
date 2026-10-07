import api from './axios'
import { attendanceRowsPayload } from '../utils/editableAttendance.mjs'

export function previewFinalCertificates(eventId, { files, mode, pagesPerParticipant, pageGroups }) {
  const body = new FormData()
  files.forEach((file) => body.append('files', file))
  body.append('mode', mode)
  body.append('pages_per_participant', String(pagesPerParticipant))
  if (pageGroups) body.append('page_groups', JSON.stringify(pageGroups))
  return api.post(`/events/${eventId}/certificates/import-preview/`, body, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
  })
}

export const applyFinalCertificates = (eventId, payload) =>
  api.post(`/events/${eventId}/certificates/import-apply/`, payload, { timeout: 180000 })

export function importAttendanceXlsx(eventId, file, dryRun = true) {
  if (dryRun !== true) throw new Error('Simpan absensi menggunakan draf yang telah divalidasi, bukan berkas Excel asli.')
  const body = new FormData()
  body.append('file', file)
  body.append('dry_run', 'true')
  return api.post(`/events/${eventId}/attendance/import-xlsx/`, body, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
  })
}

export function importAttendanceRows(eventId, rows, dryRun) {
  const payload = { rows: attendanceRowsPayload(rows), dry_run: Boolean(dryRun) }
  return api.post(`/events/${eventId}/attendance/import-xlsx/`, payload, {
    headers: { 'Content-Type': 'application/json' }, timeout: 180000,
  })
}

export async function downloadAttendanceXlsx(eventId, kind) {
  const { data } = await api.get(`/events/${eventId}/attendance/${kind}-xlsx/`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${kind === 'template' ? 'template-absensi' : 'absensi'}-${eventId}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Use the authenticated client, not a raw link. Never send its bearer token to another origin.
export async function getAuthenticatedPdf(url) {
  const base = new URL(`${api.defaults.baseURL.replace(/\/$/, '')}/`, window.location.origin)
  const target = new URL(url, base)
  if (target.origin !== base.origin || !['http:', 'https:'].includes(target.protocol)) throw new Error('Pratinjau PDF harus berasal dari server aplikasi.')
  const { data } = await api.get(target.href, { responseType: 'blob' })
  if (data.type && !['application/pdf', 'application/octet-stream'].includes(data.type.split(';')[0])) throw new Error('Server tidak mengembalikan berkas PDF. Muat ulang pratinjau.')
  return URL.createObjectURL(data)
}
