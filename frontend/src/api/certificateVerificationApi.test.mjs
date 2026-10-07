import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const calls = []
globalThis.__verificationApi = { post: async (...args) => { calls.push(args); return { data: { updated: 1 } } } }
const source = (await readFile(new URL('./certificateVerificationApi.js', import.meta.url), 'utf8')).replace("import api from './axios'", 'const api = globalThis.__verificationApi')
const adapter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('row verification and cancellation use persisted event-scoped endpoints', async () => {
  await adapter.verifyEventCertificate(7, 'uuid')
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/uuid/verify/', {}])
  await adapter.cancelEventCertificateVerification(7, 'uuid')
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/uuid/cancel-verification/', {}])
})
test('bulk operations omit ids for ALL rows including unpaginated rows', async () => {
  await adapter.verifyAllEventCertificates(7)
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/verify-all/', {}])
  await adapter.cancelAllEventCertificateVerifications(7)
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/cancel-verification-all/', {}])
})
test('verification error includes actionable backend reasons without exposing UUIDs', () => {
  assert.equal(adapter.certificateVerificationError({ response: { data: { detail: 'Tidak ada perubahan.', errors: [{ id: 'private-uuid', errors: ['PDF tidak ditemukan.', 'Peserta harus hadir.'] }] } } }), 'Tidak ada perubahan. PDF tidak ditemukan. Peserta harus hadir.')
})
test('Indonesian persisted statuses control badges and available actions', () => {
  assert.equal(adapter.certificateStatus({ status: 'tersedia', pdf_url: '/a.pdf' }).verified, true)
  assert.equal(adapter.certificateStatus({ status: 'diproses', pdf_url: '/a.pdf' }).label, 'Diproses / belum diverifikasi')
  assert.equal(adapter.certificateStatus({ status: 'diproses', pdf_url: '/a.pdf' }).canVerify, true)
  assert.equal(adapter.certificateStatus({ status: 'dicabut', pdf_url: '/a.pdf' }).canVerify, false)
  assert.equal(adapter.certificateStatus({ status: 'diproses' }).canVerify, false)
})
test('both screens wire persisted actions, reloads, confirmations and distinguish public validation', async () => {
  for (const page of ['EventDetail', 'CertificateList']) {
    const text = await readFile(new URL(`../pages/admin/${page}.jsx`, import.meta.url), 'utf8')
    assert.match(text, /verifyEventCertificate/)
    assert.match(text, /cancelEventCertificateVerification/)
    assert.match(text, /verifyAllEventCertificates/)
    assert.match(text, /cancelAllEventCertificateVerifications/)
    assert.match(text, /showCancelButton: true/)
    assert.match(text, /role="alert"/)
    assert.doesNotMatch(text, /status === '(processing|available)'/)
  }
})

// Execute the actual screen handlers with controlled UI/API boundaries, not copies
// of their logic. JSX syntax is verified separately with esbuild's transform.
async function screenHandler(page, { confirmed = true, fail = false, reloadFails = false } = {}) {
  const text = await readFile(new URL(`../pages/admin/${page}.jsx`, import.meta.url), 'utf8')
  const start = text.indexOf('  const handleVerification = async')
  const end = text.indexOf(page === 'EventDetail' ? '  const handleDownload' : '  const columns', start)
  const state = { error: 'old error', success: 'old success', busy: false, reloads: 0, confirmations: 0, actions: [] }
  const apiAction = (name) => async (...args) => {
    state.actions.push([name, ...args])
    if (fail) throw new Error('backend refused')
    return { data: { updated: 3 } }
  }
  const reload = async () => { state.reloads++; if (reloadFails) throw new Error('reload failed') }
  const bindings = {
    isAdmin: true, eventId: 7, bulkEventId: '7', eventOptions: [['7', 'Kegiatan']],
    actionLock: { current: false }, verificationLock: { current: false },
    setBusy: (value) => { state.busy = value }, setVerificationBusy: (value) => { state.busy = value },
    setError: (value) => { state.error = value }, setVerificationError: (value) => { state.error = value },
    setSuccess: (value) => { state.success = value }, setVerificationSuccess: (value) => { state.success = value },
    Swal: { fire: async () => { state.confirmations++; return { isConfirmed: confirmed } } },
    importError: (err) => err.message, certificateVerificationError: (err) => err.message, reload, onRefresh: reload,
    verifyEventCertificate: apiAction('verify-row'), cancelEventCertificateVerification: apiAction('cancel-row'),
    verifyAllEventCertificates: apiAction('verify-all'), cancelAllEventCertificateVerifications: apiAction('cancel-all'),
  }
  const handler = new Function(...Object.keys(bindings), `${text.slice(start, end)}; return handleVerification`)(...Object.values(bindings))
  return { handler, state }
}

for (const page of ['EventDetail', 'CertificateList']) {
  test(`${page}: row/all verify/cancel persist then reload and report success`, async () => {
    for (const cancel of [false, true]) for (const cert of [null, { id: 'uuid', event: 7 }]) {
      const { handler, state } = await screenHandler(page)
      await handler(cancel, cert)
      assert.equal(state.actions.length, 1)
      assert.equal(state.actions[0][0], `${cancel ? 'cancel' : 'verify'}-${cert ? 'row' : 'all'}`)
      assert.equal(String(state.actions[0][1]), '7')
      assert.equal(state.actions[0][2], cert?.id)
      assert.equal(state.reloads, 1)
      assert.equal(state.error, '')
      assert.match(state.success, /3 sertifikat berhasil/)
      assert.equal(state.busy, false)
      assert.equal(state.confirmations, !cert || cancel ? 1 : 0)
    }
  })
  test(`${page}: declined bulk confirmation neither writes nor reloads`, async () => {
    const { handler, state } = await screenHandler(page, { confirmed: false })
    await handler(false)
    assert.equal(state.actions.length, 0)
    assert.equal(state.reloads, 0)
    assert.equal(state.error, '')
    assert.equal(state.success, '')
    assert.equal(state.busy, false)
  })
  test(`${page}: API failure clears stale success, preserves rows and allows retry`, async () => {
    const { handler, state } = await screenHandler(page, { fail: true })
    await handler(false, { id: 'uuid', event: 7 })
    assert.equal(state.error, 'backend refused')
    assert.equal(state.success, '')
    assert.equal(state.reloads, 0)
    assert.equal(state.busy, false)
    await handler(true)
    assert.equal(state.actions.length, 2)
  })
  test(`${page}: persisted action with failed reload is not falsely reported as failed mutation`, async () => {
    const { handler, state } = await screenHandler(page, { reloadFails: true })
    await handler(true)
    assert.match(state.error, /berhasil disimpan.*gagal dimuat ulang/)
    assert.equal(state.success, '')
    assert.equal(state.busy, false)
  })
  test(`${page}: concurrent clicks cannot send duplicate requests`, async () => {
    const { handler, state } = await screenHandler(page)
    await Promise.all([handler(false), handler(false)])
    assert.equal(state.actions.length, 1)
  })
}

