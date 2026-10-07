import test from 'node:test'
import assert from 'node:assert/strict'
import { ATTENDANCE_FIELDS, STATUS_OPTIONS, attendanceRowsPayload, createAttendanceDraft, changeAttendanceDraft, acceptAttendanceValidation, canApplyAttendance, useAttendanceSystemData } from './editableAttendance.mjs'

const row = { row: 9, nik: '0012345678901234', nip: '001234567890123456', full_name: 'Nama', institution: 'Instansi', position: 'Jabatan', phone: '08123', email: 'x@y.id', status: '', participant_id: 42, system_status: 'existing', system_record: { nik: '999' }, certificate_history: { count: 8 } }
const valid = { dry_run: true, errors: [], rows: [row] }
test('JSON whitelist retains original row and text identities; skips removed rows and response metadata', () => {
  const payload = attendanceRowsPayload([{ ...row, skipped: false }, { ...row, row: 12, skipped: true }])
  assert.deepEqual(Object.keys(payload[0]), ['row', ...ATTENDANCE_FIELDS.map(({ key }) => key)])
  assert.equal(payload[0].nik, row.nik)
  assert.equal(payload[0].nip, row.nip)
  assert.equal(payload[0].phone, '08123')
  assert.equal(payload[0].status, '')
  assert.equal(payload.length, 1)
  assert.throws(() => attendanceRowsPayload([]), /sedikitnya/)
  assert.throws(() => attendanceRowsPayload(Array.from({ length: 5001 }, () => row)), /5000/)
})
test('every edit/remove/restore invalidates validation and confirmation, keeping original labels and edits', () => {
  let draft = createAttendanceDraft([row, { ...row, row: 12 }])
  draft = acceptAttendanceValidation(draft, valid, draft.revision)
  draft = { ...draft, confirmed: true }
  assert.equal(canApplyAttendance(draft), true)
  draft = changeAttendanceDraft(draft, 0, { full_name: 'Diperbaiki' })
  assert.equal(draft.confirmed, false)
  assert.equal(draft.validation, null)
  assert.equal(canApplyAttendance(draft), false)
  draft = changeAttendanceDraft(draft, 1, { skipped: true })
  assert.deepEqual(attendanceRowsPayload(draft.rows).map(r => r.row), [9])
  draft = acceptAttendanceValidation(draft, valid, draft.revision)
  assert.equal(draft.rows[0].full_name, 'Diperbaiki', 'server response does not overwrite edits')
  draft = changeAttendanceDraft(draft, 1, { skipped: false })
  assert.equal(draft.rows[1].row, 12)
  assert.equal(canApplyAttendance({ ...draft, confirmed: true }), false)
})
test('stale, malformed, error and empty validation can never authorize applying', () => {
  let draft = createAttendanceDraft([row])
  const before = draft.revision
  draft = changeAttendanceDraft(draft, 0, { email: 'edited@example.id' })
  assert.equal(acceptAttendanceValidation(draft, valid, before), draft)
  for (const data of [{ errors: [] }, { dry_run: true }, { ...valid, errors: [{ row: 9, column: 'nik', message: 'Konflik' }] }]) {
    const validated = acceptAttendanceValidation(draft, data, draft.revision)
    assert.equal(canApplyAttendance({ ...validated, confirmed: true }), false)
    assert.equal(validated.rows[0].email, 'edited@example.id')
  }
  let empty = createAttendanceDraft([row])
  empty = changeAttendanceDraft(empty, 0, { skipped: true })
  empty = acceptAttendanceValidation(empty, valid, empty.revision)
  assert.equal(canApplyAttendance({ ...empty, confirmed: true }), false)
})
test('system correction touches only server-specified identity fields, never contacts/status; ambiguous never guesses', () => {
  const metadata = { system_status: 'conflict', system_record: { nik: '00009999', nip: '00008888', full_name: 'Nama Sistem', email: 'wrong' }, correction_fields: ['nik', 'full_name', 'email', 'status'] }
  const corrected = useAttendanceSystemData(row, metadata)
  assert.equal(corrected.nik, '00009999')
  assert.equal(corrected.full_name, 'Nama Sistem')
  for (const key of ['nip', 'institution', 'position', 'phone', 'email', 'status', 'row']) assert.equal(corrected[key], row[key])
  assert.equal(useAttendanceSystemData(row, { ...metadata, system_status: 'ambiguous' }), row)
  assert.equal(useAttendanceSystemData(row, { ...metadata, system_record: null }), row)
})
test('invalid initial rows remain editable and removing a duplicate allows clean JSON revalidation', () => {
  const initial = { dry_run: true, rows: [row, { ...row, row: 15 }], errors: [{ row: 15, column: 'nik', message: 'Duplikat' }] }
  let draft = createAttendanceDraft(initial.rows)
  draft = acceptAttendanceValidation(draft, initial, draft.revision)
  assert.equal(canApplyAttendance({ ...draft, confirmed: true }), false)
  draft = changeAttendanceDraft(draft, 1, { skipped: true })
  assert.equal(draft.rows[1].row, 15)
  assert.equal(draft.validation, null)
  draft = acceptAttendanceValidation(draft, { ...valid, rows: attendanceRowsPayload(draft.rows) }, draft.revision)
  assert.equal(canApplyAttendance({ ...draft, confirmed: true }), true)
  const metadata = { system_status: 'conflict', system_record: { full_name: 'Koreksi' }, correction_fields: ['full_name'] }
  draft = changeAttendanceDraft({ ...draft, confirmed: true }, 0, useAttendanceSystemData(draft.rows[0], metadata))
  assert.equal(draft.rows[0].full_name, 'Koreksi')
  assert.equal(draft.confirmed, false)
  assert.equal(draft.validation, null)
})
test('all eight editable columns use text controls except status with explicit blank default', () => {
  assert.deepEqual(ATTENDANCE_FIELDS.map(f => f.key), ['nik', 'nip', 'full_name', 'institution', 'position', 'phone', 'email', 'status'])
  assert.ok(ATTENDANCE_FIELDS.filter(f => f.key !== 'status').every(f => f.type === 'text'))
  assert.deepEqual(STATUS_OPTIONS.map(o => o.value), ['', 'hadir', 'tidak_hadir'])
})
