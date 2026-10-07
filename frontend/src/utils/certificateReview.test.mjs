import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeCertificateReview, filterCertificateParticipants, updateCertificateReview, verifyCertificateRow, verifyAllCertificates, certificateReviewError, certificateAssignments } from './certificateReview.mjs'

const people = [{ id: 1, full_name: 'Sumirah', nik: '123', nip: '456' }, { id: 2, full_name: 'Budi Santoso', nik: '789' }]
const preview = (extra = {}) => ({ id: 'pdf1', detected_name: '  SUMIRAH  ', match_status: 'needs_review', ...extra })

test('unique detected attendee name preselects but never verifies', () => {
  const [row] = initializeCertificateReview([preview()], people)
  assert.equal(row.participant_id, 1)
  assert.equal(row.verified, false)
  assert.equal(row.certificate_number, '')
  assert.equal(initializeCertificateReview([preview({ detected_name: 'ＢＵＤＩ　ＳＡＮＴＯＳＯ' })], people)[0].participant_id, 2)
})
test('ambiguous, missing, partial, unknown names and non-attendee IDs are not guessed', () => {
  for (const row of [preview({ match_status: 'ambiguous', participant_id: 1 }), preview({ detected_name: 'Budi' }), preview({ detected_name: '' }), preview({ detected_name: 'Unknown', participant_id: 999 })]) {
    assert.equal(initializeCertificateReview([row], people)[0].participant_id, '')
  }
  assert.equal(initializeCertificateReview([preview()], [...people, { id: 3, full_name: 'SUMIRAH' }])[0].participant_id, '')
  assert.equal(initializeCertificateReview([preview({ participant_id: 1, match_status: 'matched' })], people)[0].participant_id, 1)
})
test('search includes names, NIK and NIP without changing the full participant pool', () => {
  assert.deepEqual(filterCertificateParticipants(people, 'SUMI'), [people[0]])
  assert.deepEqual(filterCertificateParticipants(people, '456'), [people[0]])
  assert.deepEqual(filterCertificateParticipants(people, '789'), [people[1]])
  assert.deepEqual(filterCertificateParticipants(people, 'missing'), [])
  assert.deepEqual(filterCertificateParticipants(people, ' '), people)
})
test('per-row verify and revoke; assignment and metadata edits invalidate only edited row', () => {
  let rows = initializeCertificateReview([preview(), preview({ id: 'pdf2', participant_id: 2, detected_name: 'Budi Santoso' })], people)
  rows = verifyAllCertificates(rows, people, true)
  assert.equal(certificateReviewError(rows, people), '')
  rows = updateCertificateReview(rows, 'pdf1', 'participant_id', '2')
  assert.equal(rows[0].verified, false)
  assert.equal(rows[1].verified, true)
  assert.ok(certificateReviewError(rows, people))
  rows = updateCertificateReview(rows, 'pdf1', 'participant_id', 1)
  rows = verifyCertificateRow(rows, 'pdf1', people, true)
  assert.equal(rows[0].verified, true)
  rows = updateCertificateReview(rows, 'pdf1', 'certificate_number', 'new')
  assert.equal(rows[0].verified, false)
  rows = verifyCertificateRow(rows, 'pdf2', people, false)
  assert.equal(rows[1].verified, false)
})
test('bulk verification excludes skips, rejects invalid and duplicate assignments; cancel all revokes', () => {
  let rows = initializeCertificateReview([preview(), preview({ id: 'skip', detected_name: '' })], people)
  assert.ok(certificateReviewError(rows, people))
  rows = verifyAllCertificates(rows, people, true)
  assert.equal(rows[0].verified, true)
  assert.equal(rows[1].verified, false)
  assert.equal(certificateReviewError(rows, people), '')
  assert.deepEqual(certificateAssignments(rows, people), [{ item_id: 'pdf1', participant_id: 1, certificate_number: '' }])
  rows = verifyAllCertificates(rows, people, false)
  assert.ok(certificateReviewError(rows, people))
  assert.throws(() => certificateAssignments(rows, people))
  for (const invalid of [[{ id: 'a', participant_id: 999 }], [{ id: 'a', participant_id: 1 }, { id: 'b', participant_id: '1' }], [{ id: 'skip', participant_id: '' }]]) {
    const verified = verifyAllCertificates(invalid, people, true)
    assert.ok(verified.every((row) => !row.verified))
    assert.ok(certificateReviewError(verified, people))
  }
})
