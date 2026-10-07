import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transform } from 'esbuild'

const sourceUrl = new URL('./CertificateParticipantSelect.jsx', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')
// JSX transform only, in memory; no application bundle/build or generated files.
const { code } = await transform(source, { loader: 'jsx', jsx: 'automatic', format: 'esm' })
const resolved = code.replace(/from "([^"]+)"/g, (_, specifier) => {
  const url = specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : import.meta.resolve(specifier)
  return `from ${JSON.stringify(url)}`
})
const { default: CertificateParticipantSelect } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`)
const participants = [{ id: 1, full_name: 'Sumirah', nik: '123', nip: '456' }, { id: 2, full_name: 'Budi', nik: '' }]
const render = (props = {}) => renderToStaticMarkup(React.createElement(CertificateParticipantSelect, {
  participants, value: 1, label: 'Peserta sertifikat halaman 1', onChange: () => {}, ...props,
}))

test('real participant selector renders searchable name/identity field, selected attendee, and skip', () => {
  const html = render()
  assert.match(html, /type="search"/)
  assert.match(html, /aria-label="Cari Peserta sertifikat halaman 1"/)
  assert.match(html, /Cari nama, NIK, atau NIP/)
  assert.match(html, /<option value="">Lewati — tanpa peserta<\/option>/)
  assert.match(html, /<option value="1" selected="">Sumirah · NIK 123 · NIP 456<\/option>/)
  assert.match(html, /Budi · NIK -/)
})
test('real selector disables both controls during requests; empty attendee list retains skip', () => {
  const html = render({ disabled: true, participants: [], value: '' })
  assert.match(html, /<input[^>]*disabled=""/)
  assert.match(html, /<select[^>]*disabled=""/)
  assert.match(html, /<option value="" selected="">Lewati — tanpa peserta<\/option>/)
})
