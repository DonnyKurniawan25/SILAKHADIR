import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { startCertificateCompression, stepCertificateCompression } from '../api/certificateCompressionApi'
import { importError } from '../utils/importWorkflow.mjs'

export const compressionSize = bytes => Number.isFinite(bytes) && bytes >= 0
  ? `${(bytes / 1000000).toFixed(2).replace('.', ',')} MB` : '—'
export const compressionWarning = item => Number(item.final_bytes ?? item.original_bytes) >= 2000000
export const compressionReason = item => ({
  compressed: 'Berhasil dikompres tanpa mengubah tampilan.',
  already_small: 'Ukuran sudah kecil; berkas asli dipertahankan.',
  signed: 'Tanda tangan digital kriptografis terdeteksi; berkas asli tidak diubah.',
  too_large: 'Tidak dapat diperkecil dengan aman di bawah 2 MB; berkas asli dipertahankan. Perlu penanganan manual.',
  unsupported: 'PDF tidak didukung atau terenkripsi; berkas asli dipertahankan.',
  missing: 'Berkas sertifikat tidak ditemukan.',
  error: 'Kompresi gagal; berkas asli dipertahankan.',
}[item.reason] || 'Hasil tidak dikenali; periksa berkas secara manual.')
const retryPause = () => new Promise(resolve => setTimeout(resolve, 1000))

export default function CertificateCompressionControls({ eventId, onRefresh }) {
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const jobRef = useRef(null)
  const lock = useRef(false)
  const scope = useRef({ eventId, epoch: 0, mounted: true })
  // Invalidate synchronously on render, before passive effects run.
  if (scope.current.eventId !== eventId) {
    scope.current.eventId = eventId; scope.current.epoch += 1
  }
  useEffect(() => {
    scope.current.mounted = true; scope.current.epoch += 1
    jobRef.current = null; setJob(null); setBusy(false); setError(''); setSuccess('')
    // Keep the synchronous lock until an old in-flight request settles: no overlap.
    return () => { scope.current.mounted = false; scope.current.epoch += 1 }
  }, [eventId])

  const run = async (resume = false) => {
    if (lock.current || !eventId || (resume && (!jobRef.current || jobRef.current.done))) return
    // A partial job must only be resumed, never silently replaced.
    if (!resume && jobRef.current && !jobRef.current.done) return
    const epoch = scope.current.epoch
    const active = () => scope.current.mounted && scope.current.eventId === eventId && scope.current.epoch === epoch
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    const request = async action => {
      const deadline = Date.now() + 30000
      while (active()) {
        try { return await action() } catch (err) {
          if (!active()) return null
          if (err?.response?.status !== 409 || Date.now() >= deadline) throw err
          await retryPause()
        }
      }
      return null
    }
    try {
      if (!resume) {
        const { isConfirmed } = await Swal.fire({
          icon: 'warning', title: 'Kompres ALL Sertifikat?',
          text: 'Proses SEMUA sertifikat kegiatan ini, termasuk yang tidak tampil di halaman ini. Kompresi LOSSLESS mempertahankan tampilan, termasuk tanda tangan visual Canva. PDF bertanda tangan digital kriptografis dilewati. Target di bawah 1 MB; hasil di bawah 2 MB dapat diterima. Tidak semua PDF dapat mencapai ukuran tersebut: berkas yang tetap ≥2 MB atau tidak aman dikompres dipertahankan dan ditandai untuk penanganan manual.',
          showCancelButton: true, confirmButtonText: 'Ya, kompres SEMUA', cancelButtonText: 'Batal',
        })
        if (!isConfirmed || !active()) return
        const response = await request(() => startCertificateCompression(eventId))
        if (!active() || !response) return
        const data = response.data
        // Preserve a returned job ID even if the rest of the response is invalid.
        if (data?.job_id) { jobRef.current = data; setJob(data) }
        if (!data?.job_id || !Array.isArray(data.results)) throw new Error('Respons kompresi tidak lengkap.')
      }
      while (active() && !jobRef.current.done) {
        const jobId = jobRef.current.job_id
        const response = await request(() => stepCertificateCompression(eventId, jobId, jobRef.current.processed))
        if (!active() || !response) return
        const data = response.data
        if (!data || data.job_id !== jobId || !Array.isArray(data.results)) throw new Error('Respons kompresi tidak lengkap.')
        jobRef.current = data; setJob(data)
      }
      if (!active()) return
      try { await onRefresh?.() } catch {
        if (active()) setError('Proses kompresi selesai, tetapi daftar gagal dimuat ulang. Hasil tetap tersimpan; muat ulang halaman untuk melihat berkas terbaru.')
        return
      }
      if (active()) setSuccess('Proses kompresi selesai. Periksa hasil di bawah; berkas yang dilewati atau masih ≥2 MB memerlukan pemeriksaan manual.')
    } catch (err) {
      if (active()) setError(importError(err, 'Gagal melanjutkan kompresi. Hasil sementara tetap tersimpan. Gunakan Lanjutkan kompresi untuk pekerjaan yang sudah dibuat.'))
    } finally {
      lock.current = false
      if (active()) setBusy(false)
    }
  }

  const results = Array.isArray(job?.results) ? job.results : []
  const partial = job && !job.done
  return <section className="rounded border p-4 space-y-3" aria-label="Kompresi sertifikat">
    <h3 className="font-semibold">Kompresi PDF sertifikat</h3>
    <p className="text-sm text-ink-500">Kompresi LOSSLESS untuk seluruh kegiatan, bukan hanya halaman ini. Tampilan dan tanda tangan visual dipertahankan; tanda tangan digital kriptografis dilewati. Target &lt;1 MB, hasil &lt;2 MB dapat diterima. Tidak ada jaminan semua PDF menjadi &lt;2 MB; berkas yang tidak aman diperkecil tetap asli dan perlu penanganan manual.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-outline" disabled={busy || !eventId || Boolean(partial)} onClick={() => run()}>Kompres ALL Sertifikat</button>
      {partial && <button type="button" className="btn-primary" disabled={busy || !eventId} onClick={() => run(true)}>Lanjutkan kompresi</button>}
    </div>
    {busy && <p role="status" className="text-sm">Memproses kompresi…{job ? ` ${job.processed ?? 0}/${job.total ?? 0}` : ' menyiapkan pekerjaan'}</p>}
    {job && <p className="text-sm" aria-live="polite">Progres: {job.processed ?? 0}/{job.total ?? 0} sertifikat{job.done ? ' — selesai' : ' — belum selesai'}</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="text-sm text-green-800">{success}</p>}
    {results.length > 0 && <div className="max-h-80 overflow-auto"><table className="table-base"><thead><tr><th>Nama peserta</th><th>Sebelum</th><th>Sesudah</th><th>Hasil / alasan</th></tr></thead><tbody>{results.map(item => <tr key={item.id}>
      <td>{item.participant_name || `Sertifikat ${item.id}`}</td><td>{compressionSize(item.original_bytes)}</td><td>{compressionSize(item.final_bytes)}</td>
      <td>{compressionReason(item)}{compressionWarning(item) && <strong className="block text-amber-800">Peringatan: ukuran masih ≥2 MB — perlu penanganan manual.</strong>}</td>
    </tr>)}</tbody></table></div>}
  </section>
}
