import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import axios from 'axios'

// Exercise the real public API module using an axios adapter, without a live backend.
const requests = []
let response = { found: false }
axios.defaults.adapter = async config => {
  requests.push(config)
  return { data: response, status: 200, statusText: 'OK', headers: {}, config }
}
const sourceUrl = new URL('./publicCertificateApi.js', import.meta.url)
const source = (await readFile(sourceUrl, 'utf8')).replace(/from '([^']+)'/g, (_, specifier) => {
  const url = specifier === './axios' ? 'data:text/javascript,export const API_URL = "https://example.test/api"' : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : import.meta.resolve(specifier)
  return `from ${JSON.stringify(url)}`
})
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('public search makes GET with legacy nik for NIP18, event filter, no staff auth', async () => {
  await api.checkPublicCertificate(' 198001012000011001 ', 'event-id')
  const config = requests.at(-1)
  assert.equal(config.method, 'get')
  assert.equal(config.url, '/public/certificates/check/')
  assert.deepEqual(config.params, { nik: '198001012000011001', event_id: 'event-id' })
  assert.equal(config.headers.Authorization, undefined)
  const before = requests.length
  assert.throws(() => api.checkPublicCertificate('invalid'), /16 digit/)
  assert.equal(requests.length, before)
})
test('download uses public endpoint and attached anchor with filename; rejects non-PDF responses', async () => {
  const calls = []
  const anchor = { click: () => calls.push('click'), remove: () => calls.push('remove') }
  const oldDocument = globalThis.document
  const oldTimer = globalThis.setTimeout
  globalThis.document = { createElement: () => anchor, body: { appendChild: () => calls.push('append') } }
  globalThis.setTimeout = fn => { fn(); return 0 }
  try {
    response = new Blob(['%PDF-1.4 actual-test-bytes'])
    await api.downloadPublicCertificate({ status: 'diproses', download_url: 'https://example.test/api/public/certificates/download/token/', certificate_number: '001/ABC' })
    assert.deepEqual(calls, ['append', 'click', 'remove'])
    assert.equal(anchor.download, 'Sertifikat-001_ABC.pdf')
    assert.equal(requests.at(-1).responseType, 'blob')
    response = new Blob(['<html>not a PDF</html>'])
    await assert.rejects(api.downloadPublicCertificate({ download_url: '/api/public/certificates/download/token/' }), /File PDF tidak tersedia/)
    assert.equal(calls.length, 3)
  } finally { globalThis.document = oldDocument; globalThis.setTimeout = oldTimer }
})
