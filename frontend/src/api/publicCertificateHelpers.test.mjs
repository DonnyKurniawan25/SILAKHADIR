import test from 'node:test'
import assert from 'node:assert/strict'
import { certificateSearchParams, certificateDownloadUrl, certificateFilename, certificateStatus, saveCertificateBlob } from './publicCertificateHelpers.mjs'

test('NIK16 and NIP18 use legacy GET nik key and preserve leading zeros', () => {
  assert.deepEqual(certificateSearchParams(' 0123456789012345 ', 'event-1'), { nik: '0123456789012345', event_id: 'event-1' })
  assert.deepEqual(certificateSearchParams('198001012000011001'), { nik: '198001012000011001' })
  for (const value of ['', '123', '12345678901234567', '123456789012345x']) assert.throws(() => certificateSearchParams(value), /16 digit.*18 digit/)
})
test('download availability is independent of processing; protected PDF is never a fallback', () => {
  assert.equal(certificateDownloadUrl({ status: 'processing', download_url: '/api/public/certificates/download/abc/' }), '/api/public/certificates/download/abc/')
  assert.equal(certificateDownloadUrl({ can_download: true, download_token: 'abc' }, '/api'), '/api/public/certificates/download/abc/')
  assert.equal(certificateDownloadUrl({ pdf_url: '/media/private.pdf', status: 'available' }), null)
  assert.equal(certificateDownloadUrl({ download_url: '/media/private.pdf' }), null)
})
test('availability is not evidence of verification', () => {
  assert.equal(certificateStatus({ status: 'processing', can_download: true }).verified, false)
  assert.equal(certificateStatus({ status: 'available', verified: false }).verified, false)
  assert.equal(certificateStatus({ valid: true }).verified, true)
  assert.equal(certificateStatus({ status: 'available' }).verified, false)
})
test('download filename is safe and browser anchor is attached before clicking', () => {
  assert.equal(certificateFilename({ certificate_number: '001/ABC:2026' }), 'Sertifikat-001_ABC_2026.pdf')
  const calls = []
  const anchor = { click: () => calls.push('click'), remove: () => calls.push('remove') }
  const doc = { createElement: () => anchor, body: { appendChild: () => calls.push('append') } }
  const urls = { createObjectURL: () => 'blob:pdf', revokeObjectURL: () => calls.push('revoke') }
  saveCertificateBlob(new Blob(['pdf']), 'test.pdf', { document: doc, URL: urls, setTimeout: fn => { calls.push('defer'); fn() } })
  assert.deepEqual(calls, ['append', 'click', 'remove', 'defer', 'revoke'])
  assert.equal(anchor.download, 'test.pdf')
})
