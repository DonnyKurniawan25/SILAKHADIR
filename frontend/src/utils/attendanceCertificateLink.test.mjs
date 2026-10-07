import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'
import { transform } from 'esbuild'
const url = new URL('../pages/public/AttendanceSuccess.jsx', import.meta.url)
const { code } = await transform(await readFile(url, 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'esm' })
const resolved = code.replace(/from "([^"]+)"/g, (_, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`)
const { default: Success } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`)
function render(state) { return renderToStaticMarkup(React.createElement(StaticRouter, { location: { pathname: '/absensi/test/sukses', state } }, React.createElement(Success))) }
test('attendance success links NIP-only participants to public certificate search', () => {
  assert.match(render({ nip: '199001012025011999', nik: '' }), /href="\/cek-sertifikat\?identity=199001012025011999"/)
})
test('attendance success retains NIK link and empty fallback', () => {
  assert.match(render({ nik: '9999999999999891', nip: '199001012025011999' }), /identity=9999999999999891/)
  assert.match(render({}), /href="\/cek-sertifikat"/)
})
