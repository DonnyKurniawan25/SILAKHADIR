import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCertificateNumberMode, updateCertificateNumber, certificateNumberPayload, detectedNumberCandidates, certificateNumberError } from './certificateNumbers.mjs'

const rows = [{ id: 1, certificate_number: 'A', detected_number: 'D', verified: true }, { id: 2, certificate_number: 'B', detected_number: '', verified: true }]
test('common number changes only differing rows and preserves unchanged verification', () => {
  const result = applyCertificateNumberMode(rows, 'same', 'A')
  assert.equal(result[0], rows[0])
  assert.equal(result[0].verified, true)
  assert.equal(result[1].certificate_number, 'A')
  assert.equal(result[1].verified, false)
  assert.equal(rows[1].certificate_number, 'B')
})
test('detected mode applies backend candidates including missing numbers without copying common value', () => {
  assert.deepEqual(applyCertificateNumberMode(rows, 'detected').map(r => r.certificate_number), ['D', ''])
})
test('individual no-op preserves verification; changed value uses review invalidation', () => {
  assert.equal(updateCertificateNumber(rows, 1, 'A')[0], rows[0])
  assert.equal(updateCertificateNumber(rows, 1, '')[0].verified, false)
})
test('single and ALL payloads distinguish scope, accept clear and enforce 100 characters', () => {
  assert.deepEqual(certificateNumberPayload(' X ', 'id'), { certificate_number: 'X', certificate_id: 'id' })
  assert.deepEqual(certificateNumberPayload(''), { certificate_number: '' })
  assert.equal(certificateNumberError('X'.repeat(100)), '')
  assert.throws(() => certificateNumberPayload('X'.repeat(101)), /100/)
  for (const value of ['No\n123', 'A\rB', 'A\u0000B', 'A\u007fB']) {
    assert.throws(() => certificateNumberPayload(value), /satu baris/)
  }
})
test('detection preview retains all candidates and marks found/missing without mutation', () => {
  const items = [{ id: 1, participant_name: 'Peserta Pertama', certificate_number: 'old', detected_number: ' No-1 ' }, { id: 2, participant_name: 'Peserta di Halaman Lain', detected_number: '' }]
  const result = detectedNumberCandidates(items)
  assert.deepEqual(result.map(r => [r.candidate, r.found]), [['No-1', true], ['', false]])
  assert.equal(items[0].certificate_number, 'old')
  assert.equal(result[1].participant_name, 'Peserta di Halaman Lain')
})
