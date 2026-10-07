import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ShieldCheck } from 'lucide-react'
import Swal from 'sweetalert2'
import DataTable from '../../components/DataTable'
import { listCertificates } from '../../api/certificateApi'
import {
  verifyEventCertificate, cancelEventCertificateVerification,
  verifyAllEventCertificates, cancelAllEventCertificateVerifications, certificateStatus, certificateVerificationError,
} from '../../api/certificateVerificationApi'
import { importError } from '../../utils/importWorkflow.mjs'
import { useAuth } from '../../context/AuthContext'

export default function CertificateList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [rows, setRows] = useState([])
  const [bulkEventId, setBulkEventId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const actionLock = useRef(false)
  const reload = useCallback(async () => {
    const response = await listCertificates({ page_size: 200 })
    setRows(response.data.results || response.data)
  }, [])

  useEffect(() => { reload().catch((err) => setError(importError(err, 'Daftar sertifikat gagal dimuat.'))) }, [reload])

  const eventOptions = Array.from(new Map(rows.filter((row) => row.event).map((row) => [String(row.event), row.event_title])).entries())
  const handleVerification = async (cancel, cert = null) => {
    if (!isAdmin || actionLock.current || (!cert && !bulkEventId)) return
    actionLock.current = true
    setBusy(true); setError(''); setSuccess('')
    let persisted = false
    try {
      const eventId = cert ? cert.event : bulkEventId
      if (!cert || cancel) {
        const { isConfirmed } = await Swal.fire({
          icon: 'question', title: `${cancel ? 'Batalkan verifikasi' : 'Verifikasi'} ${cert ? 'sertifikat ini' : 'semua sertifikat kegiatan'}?`,
          text: cancel
            ? `${cert ? cert.participant_name : eventOptions.find(([key]) => key === bulkEventId)?.[1] || ''}: PDF tetap disimpan. Status kembali Diproses dan PDF dapat diganti melalui impor ulang.`
            : `${eventOptions.find(([key]) => key === bulkEventId)?.[1] || ''}: Semua sertifikat kegiatan, termasuk di luar halaman ini, harus memiliki PDF dan peserta hadir. Jika satu tidak memenuhi syarat, tidak ada perubahan.`,
          showCancelButton: true, confirmButtonText: cancel ? 'Ya, batalkan verifikasi' : 'Ya, verifikasi semua', cancelButtonText: 'Kembali',
        })
        if (!isConfirmed) return
      }
      const action = cert
        ? (cancel ? cancelEventCertificateVerification : verifyEventCertificate)
        : (cancel ? cancelAllEventCertificateVerifications : verifyAllEventCertificates)
      const response = await action(eventId, cert?.id)
      persisted = true
      await reload()
      setSuccess(`${response.data.updated} sertifikat berhasil ${cancel ? 'dibatalkan verifikasinya. PDF tetap tersimpan; buka kegiatan untuk mengimpor ulang atau mengganti PDF.' : 'diverifikasi.'}`)
    } catch (err) {
      setError(persisted ? 'Perubahan berhasil disimpan, tetapi daftar gagal dimuat ulang. Muat ulang halaman untuk melihat status terbaru.' : certificateVerificationError(err))
    } finally { actionLock.current = false; setBusy(false) }
  }

  const columns = [
    {
      key: 'certificate_number', title: 'No. Sertifikat',
      render: (c) => <span className="font-mono text-xs">{c.certificate_number}</span>,
    },
    {
      key: 'participant_name', title: 'Nama Peserta',
      render: (c) => <><div className="font-semibold">{c.participant_name}</div><div className="text-xs text-ink-500 font-mono">{c.nik}</div></>,
    },
    { key: 'event_title', title: 'Kegiatan' },
    { key: 'status', title: 'Status', render: (c) => { const status = certificateStatus(c); return <span className={status.badge}>{status.label}</span> } },
    {
      key: 'generated_at', title: 'Diterbitkan',
      render: (c) => new Date(c.generated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      key: 'actions', title: 'Tindakan', className: 'text-right',
      render: (c) => {
        const status = certificateStatus(c)
        return <div className="flex flex-wrap gap-2 justify-end">
          <a href={c.verify_url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" /> Cek keaslian
          </a>
          {c.pdf_url && (isAdmin || status.verified) ? <a href={status.verified ? c.download_url || c.pdf_url : c.pdf_url} className="btn-primary !px-3 !py-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> {status.verified ? 'Unduh' : 'Pratinjau'}
          </a> : <span className="badge-yellow">Belum tersedia</span>}
          {isAdmin && c.event && <>
            {status.canVerify && <button type="button" disabled={busy} onClick={() => handleVerification(false, c)} className="btn-primary !px-2 !py-1.5 text-xs">Verifikasi sertifikat</button>}
            {status.verified && <button type="button" disabled={busy} onClick={() => handleVerification(true, c)} className="btn-outline !px-2 !py-1.5 text-xs">Batalkan verifikasi</button>}
            <Link to={`/panel/kegiatan/${c.event}`} className="btn-ghost !px-2 !py-1.5 text-xs">{status.verified ? 'Buka kegiatan' : c.pdf_url ? 'Ganti PDF di kegiatan' : 'Unggah PDF di kegiatan'}</Link>
          </>}
        </div>
      },
    },
  ]

  return <div className="space-y-4">
    <div className="border-b border-slate-200 pb-3">
      <div className="eyebrow">{isAdmin ? 'Arsip' : 'Sertifikasi'}</div>
      <h1 className="section-title mt-1">{isAdmin ? 'Daftar Sertifikat' : 'Sertifikat Saya'}</h1>
      <p className="text-ink-500 text-sm mt-1">{isAdmin ? 'Seluruh sertifikat yang pernah diterbitkan oleh sistem.' : 'Daftar sertifikat kegiatan yang Anda ikuti.'}</p>
    </div>
    {isAdmin && <div className="card space-y-2">
      <label htmlFor="certificate-bulk-event" className="text-sm font-semibold">Tindakan semua sertifikat per kegiatan</label>
      <div className="flex flex-wrap gap-2">
        <select id="certificate-bulk-event" className="input flex-1" disabled={busy} value={bulkEventId} onChange={(e) => { setBulkEventId(e.target.value); setError(''); setSuccess('') }}>
          <option value="">Pilih kegiatan</option>
          {eventOptions.map(([eventId, title]) => <option key={eventId} value={eventId}>{title}</option>)}
        </select>
        <button type="button" disabled={busy || !bulkEventId} onClick={() => handleVerification(false)} className="btn-primary">Verifikasi semua</button>
        <button type="button" disabled={busy || !bulkEventId} onClick={() => handleVerification(true)} className="btn-outline">Batalkan verifikasi semua</button>
      </div>
      <p className="text-xs text-ink-500">Berlaku untuk seluruh sertifikat kegiatan terpilih, bukan hanya baris yang tampil. Untuk kegiatan lain, buka detail kegiatan.</p>
    </div>}
    {busy && <p role="status" className="text-sm text-ink-500">Memproses verifikasi...</p>}
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded p-3">{error}</p>}
    {success && <p role="status" className="text-sm text-green-800 bg-green-50 rounded p-3">{success}</p>}
    <DataTable rows={rows} columns={columns} />
  </div>
}
