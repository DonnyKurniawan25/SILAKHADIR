import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePageGroups, validateFiles, validateAssignments } from './importWorkflow.mjs'

test('rentang campuran dan halaman tunggal', () => {
  assert.deepEqual(parsePageGroups('1-2, 3, 4-6'), [{ start: 1, end: 2 }, { start: 3, end: 3 }, { start: 4, end: 6 }])
  for (const invalid of ['0-2', '3-1', '1-3, 3-4', '1-2,,4', 'abc', '1.5-2']) assert.throws(() => parsePageGroups(invalid))
})
test('validasi PDF dan XLSX, bukan CSV/XLS, berkas kosong atau terlalu besar', () => {
  assert.equal(validateFiles([{ name: 'final.pdf', size: 100, type: 'application/pdf' }], 'pdf'), '')
  assert.equal(validateFiles([{ name: 'absensi.xlsx', size: 100, type: '' }], 'xlsx'), '')
  for (const file of [{ name: 'a.csv', size: 10 }, { name: 'a.xls', size: 10 }, { name: 'a.xlsx', size: 0 }, { name: 'a.xlsx', size: 11 * 1024 * 1024 }]) assert.ok(validateFiles([file], 'xlsx'))
  assert.ok(validateFiles([{ name: 'a.pdf', size: 10, type: 'image/png' }], 'pdf'))
  assert.ok(validateFiles([{ name: 'a.xlsx', size: 10, type: 'application/x-pdf' }], 'xlsx'))
  assert.ok(validateFiles(Array.from({ length: 101 }, () => ({ name: 'a.pdf', size: 10 })), 'pdf'))
  assert.ok(validateFiles(Array.from({ length: 6 }, () => ({ name: 'a.pdf', size: 20 * 1024 * 1024 })), 'pdf'))
})
test('pemetaan hanya peserta dari backend, duplikat ditolak, kosong dilewati', () => {
  const participants = [{ id: 1 }, { id: 2 }]
  assert.equal(validateAssignments([{ participant_id: 1 }, { participant_id: '' }], participants), '')
  assert.ok(validateAssignments([{ participant_id: 1 }, { participant_id: '1' }], participants))
  assert.ok(validateAssignments([{ participant_id: 3 }], participants))
  assert.ok(validateAssignments([{ participant_id: '' }], participants))
})
