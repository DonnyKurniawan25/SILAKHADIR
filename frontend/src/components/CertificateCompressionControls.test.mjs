import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { importError } from '../utils/importWorkflow.mjs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transform } from 'esbuild'
const source = await readFile(new URL('./CertificateCompressionControls.jsx', import.meta.url), 'utf8')
const helpers = source.slice(source.indexOf('export const compressionSize'), source.indexOf('export default function')).replaceAll('export ', '')
const { compressionSize, compressionReason, compressionWarning } = new Function(`${helpers}; return { compressionSize, compressionReason, compressionWarning }`)()
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function handlers(options = {}) {
  const state = { calls: [], refreshes: 0, confirms: [], busy: false, error: '', success: '', job: null }
  const scope = { current: { eventId: 7, epoch: 1, mounted: true } }, lock = { current: false }, jobRef = { current: null }
  let step = 0, clock = 0
  const bindings = {
    eventId: 7, scope, lock, jobRef,
    setBusy: x => { state.busy = x }, setError: x => { state.error = x }, setSuccess: x => { state.success = x }, setJob: x => { state.job = x },
    Swal: { fire: async opts => { state.confirms.push(opts); return options.confirm ? options.confirm() : { isConfirmed: options.confirmed !== false } } },
    startCertificateCompression: async (...args) => { state.calls.push(['start', ...args]); return { data: { job_id: 'job', processed: 0, total: 2, done: false, results: [] } } },
    stepCertificateCompression: async (...args) => {
      state.calls.push(['step', ...args]); step++
      if (options.step) return options.step(step, scope)
      return { data: { job_id: 'job', processed: step, total: 2, done: step >= 2, results: [{ id: step }] } }
    },
    onRefresh: async () => { state.refreshes++; if (options.refresh) await options.refresh(); if (options.reloadFail) throw new Error('reload') },
    importError, retryPause: async () => { clock += 1000; options.pause?.(scope) },
    Date: { now: () => clock },
  }
  const code = source.slice(source.indexOf('  const run = async'), source.indexOf('  const results ='))
  const run = new Function(...Object.keys(bindings), `${code}; return run`)(...Object.values(bindings))
  return { run, state, scope, jobRef, lock }
}
test('size/reasons use decimal MB, human Indonesian and strict 2MB warnings', () => {
  assert.equal(compressionSize(2000000), '2,00 MB')
  assert.equal(compressionSize(null), '—')
  for (const reason of ['compressed', 'already_small', 'signed', 'too_large', 'unsupported', 'missing', 'error']) assert.doesNotMatch(compressionReason({ reason }), /^[a-z_]+$/)
  assert.equal(compressionWarning({ final_bytes: 1999999 }), false)
  assert.equal(compressionWarning({ final_bytes: 2000000 }), true)
})
test('ALL confirm covers off-page rows and lossless constraints; sequential job then awaited refresh', async () => {
  const { run, state } = handlers()
  await Promise.all([run(), run()])
  assert.deepEqual(state.calls, [['start', 7], ['step', 7, 'job', 0], ['step', 7, 'job', 1]])
  assert.match(state.confirms[0].text, /SEMUA.*halaman/)
  assert.match(state.confirms[0].text, /LOSSLESS/)
  assert.match(state.confirms[0].text, /digital/)
  assert.equal(state.refreshes, 1)
  assert.equal(state.busy, false)
})
test('cancel or event switch during confirmation does not create job', async () => {
  const cancelled = handlers({ confirmed: false }); await cancelled.run(); assert.equal(cancelled.state.calls.length, 0)
  const d = deferred(); const h = handlers({ confirm: () => d.promise }); const pending = h.run(); h.scope.current.eventId = 8; d.resolve({ isConfirmed: true }); await pending
  assert.equal(h.state.calls.length, 0); assert.equal(h.lock.current, false)
})
test('HTTP failure retains partial job; resume never starts again; no raw JSON', async () => {
  let fail = true
  const h = handlers({ step: async n => {
    if (n === 2 && fail) throw { response: { status: 500, data: { private: 'no JSON' } } }
    return { data: { job_id: 'job', processed: Math.min(n, 2), total: 2, done: n >= 2, results: [{ id: 1 }] } }
  } })
  await h.run(); assert.equal(h.state.job.processed, 1); assert.match(h.state.error, /Gagal/); assert.doesNotMatch(h.state.error, /private|JSON/)
  fail = false; await h.run(true)
  assert.equal(h.state.calls.filter(x => x[0] === 'start').length, 1); assert.equal(h.state.refreshes, 1)
})
test('409 retries bounded on same job and exposes resume after timeout', async () => {
  const h = handlers({ step: async () => { throw { response: { status: 409 } } } })
  await h.run(); assert.equal(h.state.calls.filter(x => x[0] === 'start').length, 1)
  assert.ok(h.state.calls.length <= 33); assert.equal(h.jobRef.current.job_id, 'job'); assert.equal(h.state.busy, false)
})
test('event change/unmount after step or retry prevents next requests and refresh', async () => {
  for (const unmount of [false, true]) {
    const h = handlers({ step: async (n, scope) => { if (unmount) scope.current.mounted = false; else scope.current.eventId = 8; return { data: { job_id: 'job', processed: 1, total: 2, done: false, results: [] } } } })
    await h.run(); assert.equal(h.state.calls.length, 2); assert.equal(h.state.refreshes, 0)
  }
  const h = handlers({ step: async () => { throw { response: { status: 409 } } }, pause: scope => { scope.current.epoch++ } })
  await h.run(); assert.equal(h.state.calls.length, 2)
})
test('successful job but reload failure is distinct and does not offer reprocessing', async () => {
  const h = handlers({ reloadFail: true }); await h.run()
  assert.match(h.state.error, /selesai.*gagal dimuat ulang/); assert.equal(h.state.job.done, true); assert.equal(h.state.busy, false)
})
test('409 eventually succeeds on same step/job without recreating snapshot', async () => {
  const h = handlers({ step: async n => {
    if (n < 3) throw { response: { status: 409 } }
    return { data: { job_id: 'job', total: 1, processed: 1, done: true, results: [] } }
  } })
  await h.run(); assert.equal(h.state.calls.length, 4); assert.equal(h.state.refreshes, 1)
  assert.ok(h.state.calls.slice(1).every(call => call[2] === 'job'))
})
test('lock covers awaited refresh, and event switch during reload cannot set stale success', async () => {
  const d = deferred(); const h = handlers({ refresh: () => d.promise })
  const pending = h.run()
  while (!h.state.refreshes) await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.lock.current, true); assert.equal(h.state.busy, true)
  await h.run(); assert.equal(h.state.calls.length, 3)
  h.scope.current.eventId = 8; d.resolve(); await pending
  assert.equal(h.state.success, ''); assert.equal(h.lock.current, false)
})

// Real JSX + React SSR (in-memory transform only; no app build). Stub only API imports.
async function componentForSSR(job = null) {
  let renderSource = source.replace(/import Swal from 'sweetalert2'/, 'const Swal = {}')
    .replace(/import \{ startCertificateCompression, stepCertificateCompression \} from '[^']+'/, 'const startCertificateCompression = () => {}; const stepCertificateCompression = () => {}')
    .replace('useState(null)', `useState(${JSON.stringify(job)})`)
  const { code } = await transform(renderSource, { loader: 'jsx', jsx: 'automatic', format: 'esm' })
  const resolved = code.replace(/from "([^"]+)"/g, (_, specifier) => `from ${JSON.stringify(specifier.startsWith('.') ? new URL(specifier, import.meta.url).href : import.meta.resolve(specifier))}`)
  return (await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`)).default
}
test('real SSR exposes exact ALL action, lossless caveats and disables without event', async () => {
  const Component = await componentForSSR()
  const html = renderToStaticMarkup(React.createElement(Component, { eventId: 7 }))
  assert.match(html, />Kompres ALL Sertifikat<\/button>/); assert.match(html, /LOSSLESS/)
  assert.match(html, /Tidak ada jaminan/); assert.match(html, /kriptografis/)
  assert.doesNotMatch(html, /Lanjutkan kompresi/)
  const disabled = renderToStaticMarkup(React.createElement(Component, {}))
  assert.match(disabled, /disabled=""/)
})
test('real SSR shows partial progress, resume, names, decimal MB and ≥2MB warning', async () => {
  const Component = await componentForSSR({ job_id: 'job', total: 9, processed: 1, done: false, results: [{ id: 1, participant_name: 'Peserta off-page', original_bytes: 3000000, final_bytes: 3000000, reason: 'too_large' }] })
  const html = renderToStaticMarkup(React.createElement(Component, { eventId: 7 }))
  assert.match(html, /Lanjutkan kompresi/); assert.match(html, /Progres: 1\/9/)
  assert.match(html, /Peserta off-page/); assert.match(html, /3,00 MB/)
  assert.match(html, /Peringatan: ukuran masih ≥2 MB/); assert.match(html, /berkas asli dipertahankan/)
})
test('real lifecycle setup clears job/results on event change and invalidates cleanup without unlocking pending request', () => {
  const hooksCode = source.slice(source.indexOf('  const [job,'), source.indexOf('  const run = async'))
  const refs = [], writes = []; let cursor = 0, cleanup
  const useRef = initial => refs[cursor++] ||= { current: initial }
  const useState = initial => [initial, value => writes.push(value)]
  const useEffect = effect => { cleanup = effect() }
  const setup = new Function('eventId', 'useRef', 'useState', 'useEffect', `${hooksCode}; return { scope, lock, jobRef }`)
  let h = setup(7, useRef, useState, useEffect)
  h.jobRef.current = { job_id: 'old', results: [{ id: 1 }] }; h.lock.current = true
  const oldEpoch = h.scope.current.epoch
  cleanup(); assert.equal(h.scope.current.mounted, false)
  cursor = 0; writes.length = 0
  h = setup(8, useRef, useState, useEffect)
  assert.equal(h.scope.current.eventId, 8); assert.ok(h.scope.current.epoch > oldEpoch)
  assert.equal(h.jobRef.current, null); assert.deepEqual(writes, [null, false, '', ''])
  assert.equal(h.lock.current, true)
})
