import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transform } from 'esbuild'

async function load(filename) {
  const sourceUrl = new URL(filename, import.meta.url)
  const { code } = await transform(await readFile(sourceUrl, 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'esm' })
  const apiStub = 'data:text/javascript,' + encodeURIComponent('export const checkPublicCertificate = () => {}; export const downloadPublicCertificate = () => {}; export const verifyPublicCertificate = () => {};')
  const brandingStub = 'data:text/javascript,' + encodeURIComponent('export const useBranding = () => ({setting: {}});')
  const resolved = code.replace(/from "([^"]+)"/g, (_, specifier) => {
    const url = specifier.includes('publicCertificateApi') ? apiStub : specifier.includes('BrandingContext') ? brandingStub : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : import.meta.resolve(specifier)
    return `from ${JSON.stringify(url)}`
  })
  return import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`)
}
const { CertificateCard, CertificateSearchForm } = await load('./CheckCertificate.jsx')
const { CertificateVerificationResult } = await load('./VerifyCertificate.jsx')
const certificate = { id: '1', status: 'diproses', event_title: 'Pelatihan Pelayanan Publik', participant_name: 'Sumirah', certificate_number: '001/ABC', event_start: '2026-09-20', organizer: 'BKPSDM', verify_url: '/verifikasi/token', nik: '1234567890123456' }
const renderCard = props => renderToStaticMarkup(React.createElement(CertificateCard, { certificate: { ...certificate, ...props } }))

test('processing real PDF has primary download without falsely claiming verified', () => {
  const html = renderCard({ can_download: true, download_url: '/api/public/certificates/download/token/' })
  assert.match(html, /Unduh Sertifikat/)
  assert.match(html, /Belum terverifikasi/)
  assert.match(html, /Cek keaslian/)
  assert.match(html, /Sumirah/)
  assert.match(html, /20 September 2026/)
  assert.doesNotMatch(html, /1234567890123456|Lihat pratinjau/)
})
test('cover renders provided thumbnail; missing image has branded fallback; no PDF no button', () => {
  assert.match(renderCard({ thumbnail_url: '/media/event.jpg' }), /src="\/media\/event.jpg"/)
  const html = renderCard({ pdf_url: '/private/protected.pdf' })
  assert.match(html, /bg-gradient-to-br/)
  assert.match(html, /PDF belum tersedia/)
  assert.doesNotMatch(html, /Unduh Sertifikat|protected.pdf/)
})
test('tersedia is verified under backend contract; explicit false wins', () => {
  assert.match(renderCard({ status: 'tersedia' }), />Terverifikasi</)
  assert.match(renderCard({ status: 'tersedia', valid: false }), /Belum terverifikasi/)
})
test('search form accepts 18 characters with accessible hint, loading and validation', () => {
  const html = renderToStaticMarkup(React.createElement(CertificateSearchForm, { identity: '', onChange: () => {}, loading: true, error: 'NIK 16 digit atau NIP 18 digit' }))
  assert.match(html, /for="certificate-identity"/)
  assert.match(html, /maxLength="18"/)
  assert.match(html, /Cukup salah satu/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /role="alert"/)
  assert.match(html, /disabled=""/)
})
test('verification panel distinguishes final, pending without number, and missing', () => {
  const render = data => renderToStaticMarkup(React.createElement(CertificateVerificationResult, { data, setting: {} }))
  assert.match(render({ ...certificate, valid: true }), /Sertifikat Terverifikasi/)
  assert.match(render({ ...certificate, certificate_number: '', valid: false }), /Sertifikat Menunggu Pengesahan/)
  assert.match(render({ valid: false }), /Sertifikat Tidak Ditemukan/)
  assert.match(render({ ...certificate, valid: false, status: 'dicabut' }), /Sertifikat Telah Dicabut/)
  assert.doesNotMatch(render({ ...certificate, valid: false }), /Tersedia &amp; Sah/)
})
