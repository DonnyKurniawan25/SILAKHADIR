import test from 'node:test'
import assert from 'node:assert/strict'
import { certificateHistoryLabel } from './certificateHistory.mjs'

test('riwayat hanya ditandai jika ada sertifikat aktual', () => {
  assert.equal(certificateHistoryLabel(null), '')
  assert.equal(certificateHistoryLabel({has_certificates:false,count:2}), '')
  assert.equal(certificateHistoryLabel({has_certificates:true,count:0}), '')
  assert.equal(certificateHistoryLabel({has_certificates:true,count:1}), 'Pernah menerima 1 sertifikat')
  assert.equal(certificateHistoryLabel({has_certificates:true,count:3}), 'Pernah menerima 3 sertifikat')
})
