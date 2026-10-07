export const ATTENDANCE_FIELDS = [
  { key: 'nik', label: 'NIK', type: 'text' },
  { key: 'nip', label: 'NIP', type: 'text' },
  { key: 'full_name', label: 'Nama Lengkap', type: 'text' },
  { key: 'institution', label: 'Instansi', type: 'text' },
  { key: 'position', label: 'Jabatan', type: 'text' },
  { key: 'phone', label: 'No HP', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'status', label: 'Status', type: 'select' },
]
export function attendanceDraftPage(rows, page, size = 25) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.max(0, Math.min(pages - 1, Number.isInteger(page) ? page : 0))
  const start = current * size
  return { rows: rows.slice(start, start + size), start, current, pages }
}
export function discardAttendanceRowResult(result, number) {
  if (!result) return null
  return { ...result,
    rows: (result.rows || []).filter(row => String(row.row) !== String(number)),
    errors: (result.errors || []).filter(error => String(error.row) !== String(number)),
  }
}
export const STATUS_OPTIONS = [
  { value: '', label: 'Kosong (default: Hadir)' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Tidak hadir' },
]
const text = value => value == null ? '' : String(value)
const editableRow = row => Object.fromEntries([
  ['row', row.row], ...ATTENDANCE_FIELDS.map(({ key }) => [key, text(row[key])]),
])

// Never return participant IDs, system metadata, or client-only skip flags to the server.
export function attendanceRowsPayload(rows) {
  const active = rows.filter(row => !row.skipped)
  if (!active.length) throw new Error('Pilih sedikitnya satu baris absensi untuk divalidasi dan disimpan.')
  if (active.length > 5000) throw new Error('Maksimal 5000 baris absensi per impor.')
  return active.map(editableRow)
}
export function createAttendanceDraft(rows = []) {
  return { rows: rows.map((row, index) => ({ ...editableRow({ ...row, row: row.row ?? index + 2 }), skipped: false })), revision: 0, validation: null, validatedRevision: null, confirmed: false }
}
export function changeAttendanceDraft(draft, index, changes) {
  const allowed = Object.fromEntries(Object.entries(changes).filter(([key]) => key === 'skipped' || ATTENDANCE_FIELDS.some(field => field.key === key)))
  return { ...draft, rows: draft.rows.map((row, i) => i === index ? { ...row, ...allowed } : row), revision: draft.revision + 1, validation: null, validatedRevision: null, confirmed: false }
}
export function acceptAttendanceValidation(draft, data, revision) {
  if (revision !== draft.revision) return draft
  const complete = data?.dry_run === true && Array.isArray(data.errors) && Array.isArray(data.rows)
  return { ...draft, validation: complete ? data : null, validatedRevision: complete ? revision : null, confirmed: false }
}
export function canApplyAttendance(draft) {
  const count = draft.rows.filter(row => !row.skipped).length
  return Boolean(count > 0 && count <= 5000 && draft.confirmed && draft.validation?.dry_run === true && Array.isArray(draft.validation.errors) && !draft.validation.errors.length && draft.validatedRevision === draft.revision)
}
export function useAttendanceSystemData(row, metadata) {
  if (!['existing', 'conflict'].includes(metadata?.system_status) || !metadata.system_record || !Array.isArray(metadata.correction_fields)) return row
  const corrections = Object.fromEntries(metadata.correction_fields
    .filter(key => ['nik', 'nip', 'full_name'].includes(key) && Object.hasOwn(metadata.system_record, key))
    .map(key => [key, text(metadata.system_record[key])]))
  return Object.keys(corrections).length ? { ...row, ...corrections } : row
}
