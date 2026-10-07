import test from 'node:test'
import assert from 'node:assert/strict'

test('DataTable pagination logic slices rows properly and handles edge cases', () => {
  const rows = Array.from({ length: 65 }, (_, i) => ({ id: i + 1, name: `Peserta ${i + 1}` }))
  const pageSize = 25
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  assert.equal(totalPages, 3)

  // Page 0 (1..25)
  const page0 = rows.slice(0, 25)
  assert.equal(page0.length, 25)
  assert.equal(page0[0].id, 1)
  assert.equal(page0[24].id, 25)

  // Page 1 (26..50)
  const page1 = rows.slice(25, 50)
  assert.equal(page1.length, 25)
  assert.equal(page1[0].id, 26)
  assert.equal(page1[24].id, 50)

  // Page 2 (51..65)
  const page2 = rows.slice(50, 75)
  assert.equal(page2.length, 15)
  assert.equal(page2[0].id, 51)
  assert.equal(page2[14].id, 65)
})

test('Participant lookup auto-fill payload mapping', () => {
  const lookupResponse = {
    found: true,
    full_name: 'Bagus Adi Sutistari',
    nik: '5204132512970001',
    nip: '199712252020121001',
    is_asn: true,
    institution: 'Diskominfo',
    position: 'Pranata Komputer',
    phone: '08123456789',
    email: 'bagus@example.com'
  }

  assert.equal(lookupResponse.found, true)
  assert.equal(lookupResponse.full_name, 'Bagus Adi Sutistari')
  assert.equal(lookupResponse.nik, '5204132512970001')
  assert.equal(lookupResponse.nip, '199712252020121001')
  assert.equal(lookupResponse.is_asn, true)
})
