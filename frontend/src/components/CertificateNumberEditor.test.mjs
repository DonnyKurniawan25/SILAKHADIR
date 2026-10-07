import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { certificateNumberPayload, certificateNumberError, detectedNumberCandidates } from '../utils/certificateNumbers.mjs'

const source = await readFile(new URL('./CertificateNumberEditor.jsx', import.meta.url), 'utf8')
function handlers({ mode = 'individual', number = 'N', confirmed = true, fail = false, reloadFail = false } = {}) {
  const state = { writes: [], previews: 0, refreshes: 0, confirmations: [], error: '', success: '', busy: '', candidates: null }
  const bindings = {
    mode, number, selectedId: 'id', eventId: 7, lock: { current: false }, version: { current: 1 },
    certificateNumberPayload, certificateNumberError, detectedNumberCandidates,
    setBusy: v => { state.busy = v }, setError: v => { state.error = v }, setSuccess: v => { state.success = v }, setCandidates: v => { state.candidates = v },
    Swal: { fire: async opts => { state.confirmations.push(opts); return { isConfirmed: confirmed } } },
    updateEventCertificateNumber: async (...args) => { state.writes.push(args); if (fail) throw new Error('refused') },
    detectEventCertificateNumbers: async () => { state.previews++; return { data: { items: [{ id: 'off-page', detected_number: 'D' }, { id: 'missing', detected_number: '' }] } } },
    onRefresh: async () => { state.refreshes++; if (reloadFail) throw new Error('reload') },
    importError: err => err.message,
  }
  const code = source.slice(source.indexOf('  const detect = async'), source.indexOf('  const choices ='))
  const result = new Function(...Object.keys(bindings), `${code}; return {detect, save}`)(...Object.values(bindings))
  return { ...result, state }
}
test('editor detection retains off-page found/missing candidates and never writes', async () => {
  const { detect, state } = handlers()
  await detect()
  assert.equal(state.writes.length, 0)
  assert.equal(state.refreshes, 0)
  assert.deepEqual(state.candidates.map(item => item.found), [true, false])
  assert.equal(state.busy, '')
})
test('individual save sends exactly one number mutation then refresh', async () => {
  const { save, state } = handlers()
  await save()
  assert.deepEqual(state.writes, [[7, { certificate_number: 'N', certificate_id: 'id' }]])
  assert.equal(state.refreshes, 1)
  assert.equal(state.confirmations.length, 0)
  assert.equal(state.busy, '')
})
test('ALL save omits ID and explicitly confirms records outside current page', async () => {
  const { save, state } = handlers({ mode: 'all' })
  await save()
  assert.deepEqual(state.writes, [[7, { certificate_number: 'N' }]])
  assert.match(state.confirmations[0].text, /SEMUA.*tidak tampil/)
})
test('declined ALL or clear confirmation never writes and releases busy state', async () => {
  for (const options of [{ mode: 'all' }, { number: '' }]) {
    const { save, state } = handlers({ ...options, confirmed: false })
    await save()
    assert.equal(state.writes.length, 0)
    assert.equal(state.refreshes, 0)
    assert.equal(state.confirmations.length, 1)
    assert.equal(state.busy, '')
  }
})
test('duplicate clicks cannot write twice and failures release the lock for retry', async () => {
  const { save, state } = handlers({ fail: true })
  await Promise.all([save(), save()])
  assert.equal(state.writes.length, 1)
  assert.equal(state.error, 'refused')
  assert.equal(state.busy, '')
  await save()
  assert.equal(state.writes.length, 2)
})
test('refresh failure distinguishes successful persistence from failed mutation', async () => {
  const { save, state } = handlers({ reloadFail: true })
  await save()
  assert.match(state.error, /berhasil disimpan.*gagal dimuat ulang/)
  assert.equal(state.success, '')
  assert.equal(state.busy, '')
})
