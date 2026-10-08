import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const calls = []
globalThis.__compressionApi = { post: async (...args) => { calls.push(args); return { data: { job_id: 'job' } } } }
const source = (await readFile(new URL('./certificateCompressionApi.js', import.meta.url), 'utf8')).replace("import api from './axios'", 'const api = globalThis.__compressionApi')
const adapter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
test('start snapshots whole event; step continues same job with empty payload', async () => {
  await adapter.startCertificateCompression(7)
  await adapter.stepCertificateCompression(7, 'job')
  assert.deepEqual(calls, [['/events/7/certificates/compress-all/', {}], ['/events/7/certificates/compress-all/job/', {}]])
})
