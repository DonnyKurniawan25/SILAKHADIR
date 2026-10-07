import { validateAssignments } from './importWorkflow.mjs'

// Exact full names only: no fuzzy, substring, title stripping or filename guesses.
const normalizeName = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase('id-ID').trim().replace(/\s+/gu, ' ')
const selected = (row) => row.participant_id !== '' && row.participant_id != null

export function initializeCertificateReview(items, participants) {
  const allowed = new Set(participants.map((p) => String(p.id)))
  return items.map((item) => {
    const name = normalizeName(item.detected_name)
    const matches = name ? participants.filter((p) => normalizeName(p.full_name) === name) : []
    const ambiguous = ['ambiguous', 'duplicate'].includes(item.match_status) || matches.length > 1
    const participant_id = ambiguous ? '' : allowed.has(String(item.participant_id)) ? item.participant_id : matches.length === 1 ? matches[0].id : ''
    return { ...item, participant_id, certificate_number: String(item.certificate_number || ''), verified: false }
  })
}

export function filterCertificateParticipants(participants, query) {
  const search = normalizeName(query)
  return participants.filter((p) => normalizeName(`${p.full_name} ${p.nik || ''} ${p.nip || ''}`).includes(search))
}

export function updateCertificateReview(items, id, field, value) {
  return items.map((item) => item.id === id ? { ...item, [field]: value, verified: false } : item)
}

export function canVerifyCertificateRow(items, row, participants) {
  return selected(row) && participants.some((p) => String(p.id) === String(row.participant_id))
    && items.filter((item) => String(item.participant_id) === String(row.participant_id)).length === 1
}

export function verifyCertificateRow(items, id, participants, verified) {
  return items.map((item) => item.id === id ? { ...item, verified: Boolean(verified) && canVerifyCertificateRow(items, item, participants) } : item)
}

export function verifyAllCertificates(items, participants, verified) {
  return items.map((item) => ({ ...item, verified: Boolean(verified) && canVerifyCertificateRow(items, item, participants) }))
}

export function certificateReviewError(items, participants) {
  return validateAssignments(items, participants) || (items.some((item) => selected(item) && item.verified !== true)
    ? 'Verifikasi semua berkas yang dipilih sebelum menerapkan pemetaan.' : '')
}

// Whitelist backend fields and guard the actual submission, not just its button.
export function certificateAssignments(items, participants) {
  const error = certificateReviewError(items, participants)
  if (error) throw new Error(error)
  return items.filter(selected).map((item) => ({ item_id: item.id, participant_id: item.participant_id, certificate_number: item.certificate_number.trim() }))
}
