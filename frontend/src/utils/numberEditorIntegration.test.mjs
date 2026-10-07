import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('persisted certificate numbering is available outside legacy template editor to authorized staff', async () => {
  const source = await readFile(new URL('../pages/admin/EventDetail.jsx', import.meta.url), 'utf8')
  assert.match(source, /import CertificateNumberEditor from '..\/..\/components\/CertificateNumberEditor'/)
  assert.match(source, /canManageNumbers=\{canUploadThumbnail\}/)
  assert.match(source, /canManageNumbers && <CertificateNumberEditor eventId=\{eventId\} certificates=\{certs\} onRefresh=\{onRefresh\}/)
  assert.ok(source.indexOf('<CertificateNumberEditor') < source.indexOf('Editor lama berbasis template'))
})
