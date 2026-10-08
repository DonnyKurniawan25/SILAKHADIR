import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Compression ALL controls are available in certificate tab only for authorized admin', () => {
  const source = readFileSync(new URL('../pages/admin/EventDetail.jsx', import.meta.url), 'utf8')
  assert.match(source, /import CertificateCompressionControls from ['"]\.\.\/\.\.\/components\/CertificateCompressionControls['"]/) 
  assert.match(source, /canManageNumbers\s*&&\s*<CertificateCompressionControls\s+eventId=\{eventId\}\s+onRefresh=\{onRefresh\}/)
  assert.match(source, /CertificateNumberEditor/)
})
