import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Inject a mock authenticated client into the real API adapter, without changing production code.
const calls = []
globalThis.__finalImportTestApi = {
  defaults: { baseURL: 'https://app.example/api' },
  post: async (...args) => { calls.push(['post', ...args]); return { data: {} } },
  get: async (...args) => { calls.push(['get', ...args]); return { data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } },
}
globalThis.window = { location: { origin: 'https://app.example' } }
const source = (await readFile(new URL('./finalImportApi.js', import.meta.url), 'utf8')).replace("import api from './axios'", 'const api = globalThis.__finalImportTestApi')
const adapter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('PDF preview multipart includes mode, pages, optional mixed page groups', async () => {
  const files = [new File(['pdf'], 'canva.pdf', { type: 'application/pdf' })]
  await adapter.previewFinalCertificates(7, { files, mode: 'combined', pagesPerParticipant: 2, pageGroups: [{ start: 1, end: 2 }, { start: 3, end: 5 }] })
  const [, path, body] = calls.at(-1)
  assert.equal(path, '/events/7/certificates/import-preview/')
  assert.equal(body.get('mode'), 'combined')
  assert.equal(body.get('pages_per_participant'), '2')
  assert.equal(body.getAll('files').length, 1)
  assert.deepEqual(JSON.parse(body.get('page_groups')), [{ start: 1, end: 2 }, { start: 3, end: 5 }])
  await adapter.previewFinalCertificates(7, { files, mode: 'separate', pagesPerParticipant: 1 })
  assert.equal(calls.at(-1)[2].has('page_groups'), false)
})
test('PDF apply sends explicit assignments with replace_existing false', async () => {
  const payload = { batch_id: 'batch', assignments: [{ item_id: 'a', participant_id: 1, certificate_number: '' }], replace_existing: false }
  await adapter.applyFinalCertificates(7, payload)
  assert.equal(calls.at(-1)[1], '/events/7/certificates/import-apply/')
  assert.deepEqual(calls.at(-1)[2], payload)
})
test('attendance XLSX always declares dry_run before applying', async () => {
  const file = new File(['xlsx'], 'attendance.xlsx')
  await adapter.importAttendanceXlsx(7, file, true)
  assert.equal(calls.at(-1)[1], '/events/7/attendance/import-xlsx/')
  assert.equal(calls.at(-1)[2].get('dry_run'), 'true')
  assert.equal(calls.at(-1)[2].get('file').name, 'attendance.xlsx')
  await adapter.importAttendanceXlsx(7, file, false)
  assert.equal(calls.at(-1)[2].get('dry_run'), 'false')
})
test('PDF preview uses authenticated blobs and rejects third-party URL token leakage', async () => {
  const url = await adapter.getAuthenticatedPdf('/api/events/7/certificates/preview/')
  assert.ok(url.startsWith('blob:'))
  assert.equal(calls.at(-1)[1], 'https://app.example/api/events/7/certificates/preview/')
  assert.equal(calls.at(-1)[2].responseType, 'blob')
  URL.revokeObjectURL(url)
  const count = calls.length
  await assert.rejects(adapter.getAuthenticatedPdf('https://external.example/steal'), /server aplikasi/)
  await assert.rejects(adapter.getAuthenticatedPdf('javascript:alert(1)'), /server aplikasi/)
  assert.equal(calls.length, count)
})

test('attendance template/export download .xlsx through authenticated blob endpoints', async () => {
  const anchors = []
  globalThis.document = {
    createElement: () => { const anchor = { click() { this.clicked = true }, remove() {} }; anchors.push(anchor); return anchor },
    body: { appendChild() {} },
  }
  for (const kind of ['template', 'export']) {
    await adapter.downloadAttendanceXlsx(7, kind)
    assert.equal(calls.at(-1)[1], `/events/7/attendance/${kind}-xlsx/`)
    assert.equal(calls.at(-1)[2].responseType, 'blob')
    assert.ok(anchors.at(-1).download.endsWith('.xlsx'))
    assert.equal(anchors.at(-1).clicked, true)
  }
})
