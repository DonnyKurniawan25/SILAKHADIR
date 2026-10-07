import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { updateEventCertificateNumber, detectEventCertificateNumbers } from '../api/certificateNumberApi'
import { certificateNumberPayload, certificateNumberError, detectedNumberCandidates } from '../utils/certificateNumbers.mjs'
import { importError } from '../utils/importWorkflow.mjs'

const label = cert => cert.participant_name || cert.participant?.full_name || cert.full_name || `Sertifikat ${cert.id}`

export default function CertificateNumberEditor({ eventId, certificates = [], onRefresh }) {
  const [mode, setMode] = useState('individual')
  const [selectedId, setSelectedId] = useState('')
  const [number, setNumber] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const version = useRef(0)
  const lock = useRef(false)
  useEffect(() => {
    version.current += 1; lock.current = false
    setMode('individual'); setSelectedId(''); setNumber(''); setCandidates(null); setBusy(''); setError(''); setSuccess('')
    return () => { version.current += 1 }
  }, [eventId])

  const chooseCertificate = id => {
    setSelectedId(String(id)); setMode('individual'); setSuccess(''); setError('')
    const cert = certificates.find(item => String(item.id) === String(id)) || candidates?.find(item => String(item.id) === String(id))
    setNumber(String(cert?.certificate_number ?? ''))
  }

  const detect = async () => {
    if (lock.current || !eventId) return
    lock.current = true; setBusy('detect'); setError(''); setSuccess('')
    const current = version.current
    try {
      const { data } = await detectEventCertificateNumbers(eventId)
      if (current !== version.current) return
      if (!Array.isArray(data.items)) throw new Error('Respons deteksi tidak lengkap.')
      setCandidates(detectedNumberCandidates(data.items))
      setSuccess('Deteksi selesai. Belum ada nomor yang disimpan; pilih kandidat lalu klik Simpan.')
    } catch (err) { if (current === version.current) setError(importError(err, err.message || 'Gagal mendeteksi nomor.')) }
    finally { if (current === version.current) { lock.current = false; setBusy('') } }
  }

  const save = async () => {
    if (lock.current || !eventId || (mode === 'individual' && !selectedId)) return
    const validation = certificateNumberError(number)
    if (validation) { setError(validation); return }
    const payload = certificateNumberPayload(number, mode === 'individual' ? selectedId : undefined)
    const current = version.current
    lock.current = true; setBusy('save'); setError(''); setSuccess('')
    try {
      if (mode === 'all' || !payload.certificate_number) {
        const { isConfirmed } = await Swal.fire({
          icon: 'warning', title: !payload.certificate_number ? 'Kosongkan nomor sertifikat?' : 'Timpa nomor SEMUA sertifikat?',
          text: mode === 'all' ? `PERINGATAN: ${payload.certificate_number ? 'Nomor akan ditimpa' : 'Nomor akan dikosongkan'} pada SEMUA sertifikat kegiatan ini, termasuk yang tidak tampil di halaman ini. PDF asli dan status verifikasi tidak diubah.` : 'Nomor metadata sertifikat yang dipilih akan dikosongkan. PDF asli dan status verifikasi tidak diubah.',
          showCancelButton: true, confirmButtonText: !payload.certificate_number ? 'Ya, kosongkan' : 'Ya, timpa SEMUA', cancelButtonText: 'Batal',
        })
        if (!isConfirmed || current !== version.current) return
      }
      await updateEventCertificateNumber(eventId, payload)
      if (current !== version.current) return
      setCandidates(null)
      try { await onRefresh?.() } catch {
        if (current === version.current) setError('Nomor berhasil disimpan, tetapi daftar gagal dimuat ulang. Muat ulang halaman untuk melihat hasil.')
        return
      }
      if (current === version.current) setSuccess('Nomor metadata berhasil disimpan. PDF asli dan status verifikasi tidak diubah.')
    } catch (err) { if (current === version.current) setError(importError(err, err.message || 'Gagal menyimpan nomor sertifikat.')) }
    finally { if (current === version.current) { lock.current = false; setBusy('') } }
  }

  const choices = [...certificates, ...(candidates || []).filter(item => !certificates.some(cert => String(cert.id) === String(item.id)))]
  return <section className="rounded border p-4 space-y-3" aria-label="Pengaturan nomor sertifikat">
    <h3 className="font-semibold">Nomor sertifikat (metadata)</h3>
    <p className="text-sm text-ink-500">Nomor hanya untuk metadata pencarian/daftar. Isi PDF asli, tanda tangan, keaslian PDF, dan status verifikasi tidak diubah. Tidak perlu mengunggah ulang PDF.</p>
    <fieldset disabled={Boolean(busy)} className="space-y-3 disabled:opacity-60">
      <label className="label">Mode penomoran<select className="input mt-1" value={mode} onChange={e => { setMode(e.target.value); setNumber(''); setSelectedId(''); setSuccess(''); setError('') }}><option value="individual">Berbeda per peserta / satu sertifikat</option><option value="all">Nomor sama untuk SEMUA sertifikat kegiatan</option></select></label>
      {mode === 'individual' ? <label className="label">Pilih sertifikat<select className="input mt-1" value={selectedId} onChange={e => chooseCertificate(e.target.value)}><option value="">Pilih sertifikat</option>{choices.map(cert => <option key={cert.id} value={cert.id}>{label(cert)} — {cert.certificate_number || '(nomor kosong)'}</option>)}</select></label> : <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded">Menimpa SEMUA nomor pada kegiatan, bukan hanya sertifikat yang tampil pada halaman ini.</p>}
      <label className="label">Nomor sertifikat (maksimal 100 karakter)<input className="input mt-1" maxLength={100} value={number} onChange={e => { setNumber(e.target.value); setSuccess('') }} placeholder="Boleh kosong, wajib konfirmasi pengosongan" /></label>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={!eventId || (mode === 'individual' && !selectedId)} onClick={save}>{busy === 'save' ? 'Menyimpan...' : mode === 'all' ? 'Simpan untuk SEMUA sertifikat' : 'Simpan nomor sertifikat'}</button><button type="button" className="btn-outline" disabled={!eventId} onClick={detect}>{busy === 'detect' ? 'Mendeteksi...' : 'Deteksi No: dari PDF yang sudah ada'}</button></div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="text-sm text-green-800">{success}</p>}
    {candidates && <div className="space-y-2"><h4 className="font-semibold">Pratinjau deteksi — seluruh kegiatan ({candidates.length})</h4><p className="text-xs text-ink-500">Hasil baca saja, bukan bukti keaslian. Tidak diterapkan otomatis. Pilih satu kandidat untuk mengisi input lalu Simpan. Tidak ada penyimpanan massal kandidat berbeda agar tidak terjadi perubahan sebagian.</p><div className="max-h-64 overflow-auto"><table className="table-base"><thead><tr><th>Sertifikat</th><th>Nomor tersimpan</th><th>Hasil deteksi</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>{candidates.map(item => <tr key={item.id}><td>{label(item)}</td><td>{item.certificate_number || '—'}</td><td>{item.candidate || '—'}</td><td>{item.found ? 'Ditemukan — periksa PDF' : 'Tidak ditemukan'}</td><td><button type="button" className="btn-outline" disabled={Boolean(busy) || !item.found} onClick={() => { setMode('individual'); setSelectedId(String(item.id)); setNumber(item.candidate); setSuccess('Kandidat diisi ke input saja. Klik Simpan untuk menerapkan.'); setError('') }}>Pilih kandidat</button></td></tr>)}</tbody></table></div></div>}
  </section>
}
