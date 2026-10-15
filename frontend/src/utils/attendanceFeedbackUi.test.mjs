import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function loadComponent() {
  const source = readFileSync(new URL('../components/AttendanceFeedback.jsx', import.meta.url), 'utf8')
  const { code } = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports.default
}

test('feedback textarea is accessible, required, bounded and rejects whitespace', () => {
  const Component = loadComponent()
  let rules
  const html = renderToStaticMarkup(React.createElement(Component, {
    register: (name, options) => { assert.equal(name, 'feedback'); rules = options; return { name } },
    error: { message: 'Kritik dan Saran wajib diisi.' },
  }))
  assert.match(html, /<textarea[^>]+id="feedback"/)
  assert.match(html, /required=""/)
  assert.match(html, /maxLength="2000"/i)
  assert.match(html, /for="feedback"/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /Kritik dan Saran wajib diisi\./)
  assert.ok(rules.required)
  assert.equal(rules.maxLength.value, 2000)
  assert.notEqual(rules.validate(' \n\t\u2003 '), true)
  assert.equal(rules.validate('Materi baik'), true)
})

test('public form places feedback ABOVE signature without changing signature preservation', () => {
  const source = readFileSync(new URL('../pages/public/AttendanceForm.jsx', import.meta.url), 'utf8')
  assert.ok(source.indexOf('<AttendanceFeedback ') > 0)
  assert.ok(source.indexOf('<AttendanceFeedback ') < source.indexOf('<SignatureCanvas'))
  assert.match(source, /if \(saved\) canvas\.fromData\(saved\)/)
  assert.match(source, /sigDataRef\.current = sigRef\.current\.toData\(\)/)
  assert.match(source, /\.\.\.data,/)
})

test('event participant table offers searchable multiline feedback as escaped React text', () => {
  const source = readFileSync(new URL('../pages/admin/ParticipantList.jsx', import.meta.url), 'utf8')
  assert.match(source, /key: 'feedback', title: 'Kritik dan Saran'/)
  assert.match(source, /searchValue: \(p\) => p\.feedback \|\| ''/)
  assert.match(source, /whitespace-pre-wrap/)
  assert.match(source, /\{p\.feedback\}/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})
