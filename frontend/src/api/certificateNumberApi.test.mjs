import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const calls = []
globalThis.__numberApi = { post: async (...args) => { calls.push(args); return { data: { items: [] } } } }
const source = (await readFile(new URL('./certificateNumberApi.js', import.meta.url), 'utf8')).replace("import api from './axios'", 'const api = globalThis.__numberApi')
const adapter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
test('single and event-wide requests use one endpoint; ALL omits certificate_id', async () => {
  await adapter.updateEventCertificateNumber(7, { certificate_number: 'A', certificate_id: 'uuid' })
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/number/', { certificate_number: 'A', certificate_id: 'uuid' }])
  await adapter.updateEventCertificateNumber(7, { certificate_number: '' })
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/number/', { certificate_number: '' }])
})
test('detection makes only a preview request, never a number mutation', async () => {
  const count = calls.length
  await adapter.detectEventCertificateNumbers(7)
  assert.equal(calls.length, count + 1)
  assert.deepEqual(calls.at(-1), ['/events/7/certificates/detect-numbers/', {}])
})
