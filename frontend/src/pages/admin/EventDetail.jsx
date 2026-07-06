import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Calendar, MapPin, Building2, ArrowLeft, Copy, Check,
  LockKeyhole, Award, Users2, Upload, RefreshCw, UploadCloud,
  QrCode, Printer, Download, FileText,
} from 'lucide-react'
import Swal from 'sweetalert2'
import Loading from '../../components/Loading'
import { StatusBadge } from './Dashboard'
import ParticipantList from './ParticipantList'
import UploadCertificateModal from './UploadCertificateModal'
import BulkUploadModal from './BulkUploadModal'
import EventReportTab from './EventReportTab'
import { closeEvent, finishEvent, getEvent, getAttendanceLink } from '../../api/eventApi'
import {
  listEventCertificates, replaceCertificateFile,
} from '../../api/certificateApi'

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('participants')
  const [certs, setCerts] = useState([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const loadEvent = () => {
    getEvent(id).then((r) => setEvent(r.data))
    getAttendanceLink(id).then((r) => setLink(r.data))
    listEventCertificates(id).then((r) => setCerts(r.data.results || r.data))
  }

  useEffect(() => { loadEvent() }, [id])

  const handleClose = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: 'question', title: 'Tutup absensi kegiatan?',
      text: 'Peserta tidak dapat mengisi daftar hadir setelah ditutup.',
      showCancelButton: true, confirmButtonText: 'Ya, tutup',
    })
    if (!isConfirmed) return
    await closeEvent(id); loadEvent()
  }

  const handleFinish = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: 'question', title: 'Tandai kegiatan selesai?',
      text: 'Status kegiatan akan diubah menjadi Selesai.',
      showCancelButton: true, confirmButtonText: 'Ya',
    })
    if (!isConfirmed) return
    await finishEvent(id); loadEvent()
  }

  const copyLink = async () => {
    if (!link?.url) return
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!event) return <Loading />

  return (
    <div className="space-y-5">
      <Link to="/panel/kegiatan" className="text-sm text-ink-500 hover:text-brand-800 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Kegiatan
      </Link>

      {/* Kop kegiatan */}
      <div className="border border-slate-200 rounded bg-white overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <div className="eyebrow">Detail Kegiatan</div>
              <h1 className="font-serif font-bold text-2xl text-ink-900 mt-1">{event.title}</h1>
              {event.theme && <p className="text-ink-700 mt-1">{event.theme}</p>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(event.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' s.d. '}
                  {new Date(event.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                {event.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</span>}
                {event.organizer && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{event.organizer}</span>}
              </div>
            </div>
            <div className="text-left md:text-right">
              <StatusBadge status={event.status_display} raw={event.status} />
              <div className="mt-2 text-xs text-ink-500 space-y-0.5">
                <div>Peserta: <span className="font-mono text-ink-900 font-semibold">{event.total_participants}</span></div>
                <div>Hadir: <span className="font-mono text-ink-900 font-semibold">{event.total_attended}</span></div>
                <div>Sertifikat: <span className="font-mono text-ink-900 font-semibold">{event.total_certificates}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="eyebrow mb-1">Tautan Daftar Hadir</div>
            <div className="flex items-center gap-2 break-all">
              <code className="flex-1 text-xs text-brand-800 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-mono">
                {link?.url || '-'}
              </code>
              <button onClick={copyLink} className="btn-outline !px-3" title="Salin tautan">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="gov-divider" />
      </div>

      {/* QR Absensi */}
      {link?.qr_image_url && event.status === 'open' && event.attendance_open && (
        <div className="border border-slate-200 rounded bg-white p-5 flex flex-col md:flex-row items-center gap-6">
          <div className="p-2 border border-slate-300 rounded bg-white">
            <img
              src={`${link.qr_image_url}?t=${new Date(event.updated_at).getTime()}`}
              alt="QR Absensi"
              className="w-44 h-44 object-contain"
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="eyebrow flex items-center gap-1.5 justify-center md:justify-start">
              <QrCode className="w-3 h-3" /> Kode QR Aktif
            </div>
            <h3 className="font-serif font-bold text-xl text-ink-900 mt-1">
              Pindai untuk Mengisi Daftar Hadir
            </h3>
            <p className="text-sm text-ink-500 mt-1 max-w-md">
              Peserta dapat memindai kode QR ini menggunakan kamera ponsel untuk langsung
              membuka formulir daftar hadir.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 justify-center md:justify-start">
              <a
                href={link.qr_image_url}
                download={`qr-${event.public_slug}.png`}
                className="btn-outline"
              >
                <Download className="w-4 h-4" /> Unduh PNG
              </a>
              <Link
                to={`/panel/kegiatan/${id}/qr-print`}
                target="_blank"
                className="btn-primary"
              >
                <Printer className="w-4 h-4" /> Cetak Lembar QR
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tindakan */}
      <div className="border border-slate-200 rounded bg-white p-4">
        <div className="eyebrow mb-2">Tindakan</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleClose} className="btn-outline">
            <LockKeyhole className="w-4 h-4" /> Tutup Absensi
          </button>
          <button onClick={handleFinish} className="btn-outline">
            <Check className="w-4 h-4" /> Tandai Selesai
          </button>
          <div className="flex-1" />
          <button onClick={() => setUploadOpen(true)} className="btn-outline">
            <Upload className="w-4 h-4" /> Unggah Sertifikat
          </button>
          <button onClick={() => setBulkOpen(true)} className="btn-primary">
            <UploadCloud className="w-4 h-4" /> Unggah Massal
          </button>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-0 border-b border-slate-200 flex-wrap">
        <TabBtn active={tab === 'participants'} onClick={() => setTab('participants')}>
          <Users2 className="w-4 h-4" /> Peserta
        </TabBtn>
        <TabBtn active={tab === 'certificates'} onClick={() => setTab('certificates')}>
          <Award className="w-4 h-4" /> Sertifikat ({certs.length})
        </TabBtn>
        <TabBtn active={tab === 'report'} onClick={() => setTab('report')}>
          <FileText className="w-4 h-4" /> Laporan Kegiatan
        </TabBtn>
      </div>

      {tab === 'participants' && <ParticipantList eventId={id} />}
      {tab === 'certificates' && (
        <CertTab eventId={id} certs={certs} onRefresh={loadEvent} />
      )}
      {tab === 'report' && <EventReportTab eventId={id} />}

      <UploadCertificateModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        eventId={id}
        onUploaded={loadEvent}
      />

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        eventId={id}
        onUploaded={loadEvent}
      />
    </div>
  )
}

function TabBtn({ active, children, ...props }) {
  return (
    <button
      className={`px-4 py-2.5 flex items-center gap-2 text-sm font-semibold border-b-2 -mb-px transition
                  ${active
                    ? 'border-brand-800 text-brand-800'
                    : 'border-transparent text-ink-500 hover:text-brand-800 hover:border-slate-300'}`}
      {...props}
    >
      {children}
    </button>
  )
}

function CertTab({ eventId, certs, onRefresh }) {
  const handleReplace = async (cert) => {
    const { value: file } = await Swal.fire({
      title: 'Ganti Berkas PDF',
      html: `<p class="text-sm text-ink-500">Nomor: <code>${cert.certificate_number}</code></p>`,
      input: 'file',
      inputAttributes: { accept: 'application/pdf' },
      showCancelButton: true, confirmButtonText: 'Unggah',
    })
    if (!file) return
    try {
      await replaceCertificateFile(eventId, cert.id, file)
      Swal.fire({ icon: 'success', title: 'Berkas diganti', timer: 1200, showConfirmButton: false })
      onRefresh?.()
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e?.response?.data?.detail || 'Error' })
    }
  }

  if (!certs.length) {
    return (
      <div className="border border-slate-200 rounded bg-white p-10 text-center">
        <Award className="w-10 h-10 text-ink-300 mx-auto mb-2" />
        <p className="text-ink-500">Belum ada sertifikat. Gunakan tombol Unggah Sertifikat atau Unggah Massal di atas.</p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="table-base">
        <thead>
          <tr>
            <th>No. Sertifikat</th>
            <th>Nama Peserta</th>
            <th>NIK</th>
            <th>Sumber</th>
            <th>Status</th>
            <th className="text-right pr-4">Tindakan</th>
          </tr>
        </thead>
        <tbody>
          {certs.map((c) => (
            <tr key={c.id}>
              <td className="font-mono text-xs">{c.certificate_number}</td>
              <td className="font-semibold">{c.participant_name}</td>
              <td className="font-mono text-xs">{c.nik}</td>
              <td>
                {c.source === 'uploaded'
                  ? <span className="badge-blue">Unggah</span>
                  : <span className="badge-gray">Otomatis</span>}
              </td>
              <td><span className="badge-green">{c.status}</span></td>
              <td className="text-right pr-4">
                <div className="flex gap-1 justify-end">
                  <button onClick={() => handleReplace(c)} className="btn-ghost !px-2 !py-1.5 text-xs" title="Ganti berkas">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <a href={c.verify_url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1.5 text-xs">Verifikasi</a>
                  {c.pdf_url ? (
                    <a href={c.download_url} className="btn-primary !px-3 !py-1.5 text-xs">Unduh</a>
                  ) : (
                    <span className="badge-yellow">Tanpa PDF</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
