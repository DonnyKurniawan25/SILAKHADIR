import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Calendar, MapPin, Building2, ArrowLeft, Copy, Check,
  LockKeyhole, Award, Users2, Upload, UploadCloud,
  QrCode, Printer, Download, FileText, Save,
} from 'lucide-react'
import Swal from 'sweetalert2'
import Loading from '../../components/Loading'
import { StatusBadge } from './Dashboard'
import ParticipantList from './ParticipantList'
import UploadCertificateModal from './UploadCertificateModal'
import BulkUploadModal from './BulkUploadModal'
import PdfPreviewModal from './PdfPreviewModal'
import CertificateNumberEditor from '../../components/CertificateNumberEditor'
import CertificateCompressionControls from '../../components/CertificateCompressionControls'
import { getAuthenticatedPdf } from '../../api/finalImportApi'
import { importError } from '../../utils/importWorkflow.mjs'
import EventReportTab from './EventReportTab'
import {
  verifyEventCertificate, cancelEventCertificateVerification,
  verifyAllEventCertificates, cancelAllEventCertificateVerifications, certificateStatus, certificateVerificationError,
} from '../../api/certificateVerificationApi'
import { useAuth } from '../../context/AuthContext'
import { closeEvent, finishEvent, getEvent, getAttendanceLink, uploadEventThumbnail } from '../../api/eventApi'
import {
  listEventCertificates, configureEventCertificate,
  getEventCertificateConfig, suggestEventCertificateLayout,
} from '../../api/certificateApi'

export default function EventDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const canUploadThumbnail = ['admin', 'superadmin'].includes(user?.role)
  const thumbnailInput = useRef(null)
  const thumbnailLock = useRef(false)
  const [thumbnailBusy, setThumbnailBusy] = useState(false)
  const [thumbnailError, setThumbnailError] = useState('')
  const [thumbnailSuccess, setThumbnailSuccess] = useState('')
  const [event, setEvent] = useState(null)
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('participants')
  const [certs, setCerts] = useState([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)

  const loadEvent = () => {
    setRefreshVersion((value) => value + 1)
    return Promise.all([
      getEvent(id).then((r) => setEvent(r.data)),
      getAttendanceLink(id).then((r) => setLink(r.data)),
      listEventCertificates(id).then((r) => setCerts(r.data.results || r.data)),
    ])
  }

  useEffect(() => { loadEvent() }, [id])

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || thumbnailLock.current) return
    setThumbnailError(''); setThumbnailSuccess('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setThumbnailError('Pilih foto PNG, JPEG, atau WebP. SVG tidak diizinkan.'); return
    }
    if (file.size > 5 * 1024 * 1024) {
      setThumbnailError('Ukuran foto maksimal 5 MB.'); return
    }
    thumbnailLock.current = true
    setThumbnailBusy(true)
    try {
      const response = await uploadEventThumbnail(id, file)
      setEvent(response.data)
      setThumbnailSuccess('Foto thumbnail kegiatan berhasil disimpan.')
    } catch (err) {
      const detail = err?.response?.data?.thumbnail || err?.response?.data?.detail
      setThumbnailError(Array.isArray(detail) ? detail.join(' ') : detail || 'Foto gagal diunggah. Silakan coba lagi.')
    } finally {
      thumbnailLock.current = false
      setThumbnailBusy(false)
    }
  }

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

      <section className="border border-slate-200 rounded bg-white p-5 space-y-3" aria-label="Foto thumbnail kegiatan">
        <div className="eyebrow">Foto Thumbnail Kegiatan (Opsional)</div>
        {event.thumbnail_url
          ? <img src={event.thumbnail_url} alt={`Thumbnail kegiatan ${event.title}`} className="w-full max-w-xl max-h-80 object-contain rounded border border-slate-200 bg-slate-50" />
          : <p className="text-sm text-ink-500">Belum ada foto thumbnail. Kegiatan tetap dapat digunakan tanpa foto.</p>}
        {canUploadThumbnail && <>
          <input ref={thumbnailInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Pilih foto thumbnail kegiatan" disabled={thumbnailBusy} onChange={handleThumbnailUpload} />
          <button type="button" className="btn-outline" disabled={thumbnailBusy} onClick={() => thumbnailInput.current?.click()}>
            <Upload className="w-4 h-4" /> {thumbnailBusy ? 'Mengunggah foto...' : 'Upload Foto Thumbnail Kegiatan'}
          </button>
          <p className="text-xs text-ink-500">PNG, JPEG, atau WebP; maksimal 5 MB dan 4096 × 4096 piksel. Foto baru akan menggantikan foto sebelumnya.</p>
        </>}
        {thumbnailError && <p role="alert" className="text-sm text-red-700">{thumbnailError}</p>}
        {thumbnailSuccess && <p role="status" className="text-sm text-green-800">{thumbnailSuccess}</p>}
      </section>

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
            <Upload className="w-4 h-4" /> PDF Final Satu Peserta
          </button>
          <button onClick={() => setBulkOpen(true)} className="btn-primary">
            <UploadCloud className="w-4 h-4" /> Impor PDF Final Canva
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

      {tab === 'participants' && <ParticipantList eventId={id} refreshVersion={refreshVersion} onChanged={loadEvent} />}
      {tab === 'certificates' && (
        <CertTab eventId={id} certs={certs} onRefresh={loadEvent} onImport={() => setBulkOpen(true)} canManageNumbers={canUploadThumbnail} />
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

const DEFAULT_CERT_LAYOUT = {
  name_position_x: 50, name_position_y: 45, number_position_x: 50, number_position_y: 30,
  qr_position_x: 10, qr_position_y: 85, qr_size: 14,
  signature_position_x: 82, signature_position_y: 82, signature_width: 14, signature_height: 8,
  name_font_size: 36, number_font_size: 14,
}

function CertTab({ eventId, certs, onRefresh, onImport, canManageNumbers = false }) {
  const [pdfPreview, setPdfPreview] = useState('')
  const [downloading, setDownloading] = useState(null)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [verificationError, setVerificationError] = useState('')
  const [verificationSuccess, setVerificationSuccess] = useState('')
  const verificationLock = useRef(false)
  const handleVerification = async (cancel, cert = null) => {
    if (verificationLock.current) return
    verificationLock.current = true
    setVerificationBusy(true)
    setVerificationError(''); setVerificationSuccess('')
    let persisted = false
    try {
      if (!cert || cancel) {
        const { isConfirmed } = await Swal.fire({
          icon: 'question', title: `${cancel ? 'Batalkan verifikasi' : 'Verifikasi'} ${cert ? 'sertifikat ini' : 'semua sertifikat kegiatan'}?`,
          text: cancel ? 'PDF tetap disimpan. Status kembali Diproses dan PDF dapat diimpor ulang atau diganti.' : 'Semua sertifikat kegiatan, termasuk yang tidak tampil di halaman ini, harus memiliki PDF dan peserta hadir. Jika satu tidak memenuhi syarat, tidak ada perubahan.',
          showCancelButton: true, confirmButtonText: cancel ? 'Ya, batalkan verifikasi' : 'Ya, verifikasi semua', cancelButtonText: 'Kembali',
        })
        if (!isConfirmed) return
      }
      const action = cert
        ? (cancel ? cancelEventCertificateVerification : verifyEventCertificate)
        : (cancel ? cancelAllEventCertificateVerifications : verifyAllEventCertificates)
      const response = await action(eventId, cert?.id)
      persisted = true
      await onRefresh()
      setVerificationSuccess(`${response.data.updated} sertifikat berhasil ${cancel ? 'dibatalkan verifikasinya. PDF tetap tersimpan dan dapat diganti melalui impor ulang.' : 'diverifikasi.'}`)
    } catch (err) {
      setVerificationError(persisted ? 'Perubahan berhasil disimpan, tetapi daftar gagal dimuat ulang. Muat ulang halaman untuk melihat status terbaru.' : certificateVerificationError(err))
    } finally { verificationLock.current = false; setVerificationBusy(false) }
  }
  const handleDownload = async (cert) => {
    setDownloading(cert.id)
    let url = ''
    try {
      url = await getAuthenticatedPdf(certificateStatus(cert).verified ? cert.download_url || cert.pdf_url : cert.pdf_url)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `sertifikat-${cert.id}.pdf`
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
    } catch (err) { Swal.fire({ icon: 'error', title: 'Unduh PDF gagal', text: importError(err, err.message || 'Berkas tidak dapat diunduh.') }) }
    finally { setDownloading(null); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000) }
  }
  return <div className="space-y-4">
    <section className="card space-y-3">
      <div className="eyebrow">Sertifikat PDF final</div>
      <h2 className="font-serif font-bold text-lg">PDF Canva sudah lengkap dan ditandatangani</h2>
      <p className="text-sm text-ink-600">Impor satu PDF gabungan atau banyak PDF terpisah. Atur halaman per peserta atau rentang campuran, lalu tinjau dan koreksi pemetaan ke peserta hadir sebelum menerapkan. Sistem tidak menambahkan teks, barcode, maupun tanda tangan pada PDF final.</p>
      <button type="button" onClick={onImport} className="btn-primary"><UploadCloud className="w-4 h-4" /> Impor dan tinjau PDF final</button>
      <p className="text-xs text-ink-500">Untuk mengganti PDF, impor kembali dan pilih “Ganti sertifikat yang sudah ada” setelah memeriksa peserta.</p>
    </section>
    {canManageNumbers && <CertificateNumberEditor eventId={eventId} certificates={certs} onRefresh={onRefresh} />}
    {canManageNumbers && <CertificateCompressionControls eventId={eventId} onRefresh={onRefresh} />}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={verificationBusy || !certs.length} onClick={() => handleVerification(false)} className="btn-primary">Verifikasi semua</button>
      <button type="button" disabled={verificationBusy || !certs.length} onClick={() => handleVerification(true)} className="btn-outline">Batalkan verifikasi semua</button>
      {verificationBusy && <span role="status" className="text-sm text-ink-500">Memproses verifikasi...</span>}
    </div>
    {verificationError && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded p-3">{verificationError}</p>}
    {verificationSuccess && <p role="status" className="text-sm text-green-800 bg-green-50 rounded p-3">{verificationSuccess}</p>}
    {!certs.length ? <div className="card text-center text-ink-500">Belum ada sertifikat.</div> : <div className="card p-0 overflow-x-auto"><table className="table-base"><thead><tr><th>Nomor (metadata)</th><th>Nama peserta</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
      {certs.map((cert) => {
        const status = certificateStatus(cert)
        return <tr key={cert.id}>
          <td className="font-mono text-xs">{cert.certificate_number || '-'}</td>
          <td className="font-semibold">{cert.participant_name}</td>
          <td><span className={status.badge}>{status.label}</span></td>
          <td><div className="flex flex-wrap gap-2">
            {cert.pdf_url && <>
              <button type="button" onClick={() => setPdfPreview(cert.pdf_url)} className="btn-outline !py-1.5 text-xs">Pratinjau PDF</button>
              <button type="button" disabled={downloading !== null} onClick={() => handleDownload(cert)} className="btn-primary !py-1.5 text-xs">{downloading === cert.id ? 'Mengunduh...' : status.verified ? 'Unduh PDF' : 'Unduh pratinjau'}</button>
            </>}
            {status.canVerify && <button type="button" disabled={verificationBusy} onClick={() => handleVerification(false, cert)} className="btn-primary !py-1.5 text-xs">Verifikasi sertifikat</button>}
            {status.verified && <button type="button" disabled={verificationBusy} onClick={() => handleVerification(true, cert)} className="btn-outline !py-1.5 text-xs">Batalkan verifikasi</button>}
            {!status.verified && <button type="button" disabled={verificationBusy} onClick={onImport} className="btn-outline !py-1.5 text-xs">{cert.pdf_url ? 'Ganti PDF melalui impor' : 'Unggah PDF melalui impor'}</button>}
          </div></td>
        </tr>
      })}
    </tbody></table></div>}
    <details className="border rounded p-4" onToggle={(e) => setLegacyOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm text-ink-500">Editor lama berbasis template (opsional, bukan alur PDF final)</summary>
      <p className="text-sm text-amber-800 bg-amber-50 rounded p-3 my-3">Fitur lama untuk sertifikat yang dibuat dari template gambar. Jangan gunakan untuk PDF final Canva. Simpan konfigurasi lama hanya jika diperlukan; data sertifikat lama tetap ditampilkan di atas.</p>
      {legacyOpen && <LegacyCertEditor eventId={eventId} certs={certs} onRefresh={onRefresh} />}
    </details>
    <PdfPreviewModal url={pdfPreview} onClose={() => setPdfPreview('')} />
  </div>
}

function LegacyCertEditor({ eventId, certs, onRefresh }) {
  const [templateImage, setTemplateImage] = useState(null)
  const [signatureImage, setSignatureImage] = useState(null)
  const [templatePreview, setTemplatePreview] = useState('')
  const [signaturePreview, setSignaturePreview] = useState('')
  const [certificateNumber, setCertificateNumberValue] = useState('')
  const [applyAll, setApplyAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [error, setError] = useState('')
  const [suggestionNote, setSuggestionNote] = useState('')
  const [layout, setLayout] = useState(DEFAULT_CERT_LAYOUT)
  const [selected, setSelected] = useState('name')
  const [templateRatio, setTemplateRatio] = useState(1.414)
  const surfaceRef = useRef(null)
  const requestId = useRef(0)
  const resizeState = useRef(null)
  const objectUrls = useRef({ template: '', signature: '' })

  const setLayoutValue = (key, value) => setLayout((old) => ({ ...old, [key]: Number(value) }))
  const loadConfig = useCallback(async (preserveLocalPreviews = false) => {
    const id = ++requestId.current
    setLoadingConfig(true)
    try {
      const response = await getEventCertificateConfig(eventId)
      if (id !== requestId.current) return
      const data = response.data || {}
      setLayout((old) => ({ ...old, ...Object.fromEntries(Object.entries(DEFAULT_CERT_LAYOUT).map(([key, fallback]) => [key, Number(data.layout?.[key] ?? old[key] ?? fallback)])) }))
      setCertificateNumberValue(data.certificate_number || '')
      if (!preserveLocalPreviews || !objectUrls.current.template) setTemplatePreview(data.template_image_url || '')
      if (!preserveLocalPreviews || !objectUrls.current.signature) setSignaturePreview(data.signature_image_url || '')
      setError('')
    } catch (err) {
      if (id === requestId.current) setError(err?.response?.data?.detail || 'Konfigurasi sertifikat gagal dimuat.')
    } finally {
      if (id === requestId.current) setLoadingConfig(false)
    }
  }, [eventId])

  useEffect(() => {
    loadConfig()
    return () => {
      requestId.current += 1
      Object.values(objectUrls.current).forEach((url) => url && URL.revokeObjectURL(url))
    }
  }, [loadConfig])

  const setFile = (file, kind, setFileState, setPreview) => {
    if (objectUrls.current[kind]) URL.revokeObjectURL(objectUrls.current[kind])
    const url = file ? URL.createObjectURL(file) : ''
    objectUrls.current[kind] = url
    setFileState(file || null)
    setPreview(url)
  }

  const move = useCallback((key, clientX, clientY) => {
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    setLayout((old) => ({ ...old, [`${key}_position_x`]: Number(x.toFixed(2)), [`${key}_position_y`]: Number(y.toFixed(2)) }))
  }, [])

  const handleConfigure = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await configureEventCertificate(eventId, { templateImage, signatureImage, certificateNumber: certificateNumber.trim(), applyAll, layout })
      await loadConfig(true)
      onRefresh?.()
      Swal.fire({ icon: 'success', title: 'Tata letak disimpan', text: 'Pratinjau sertifikat dibuat ulang.', timer: 1800, showConfirmButton: false })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Tata letak gagal disimpan.')
      Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: err?.response?.data?.detail || 'Terjadi kesalahan.' })
    } finally { setSaving(false) }
  }

  const handleSuggest = async () => {
    if (!templateImage && !templatePreview) { setError('Unggah template terlebih dahulu untuk menyarankan posisi otomatis.'); return }
    setSuggesting(true); setError(''); setSuggestionNote('')
    try {
      const response = await suggestEventCertificateLayout(eventId, templateImage)
      const suggestion = response.data || {}
      if (suggestion.layout) setLayout((old) => ({ ...old, ...suggestion.layout }))
      setSuggestionNote(`Saran awal dari analisis gambar${suggestion.confidence != null ? ` (keyakinan ${Math.round(Number(suggestion.confidence) * 100)}%)` : ''}. Periksa dan sesuaikan sebelum menyimpan; hasil tidak dijamin akurat.`)
    } catch (err) { setError(err?.response?.data?.detail || 'Saran posisi otomatis gagal dibuat.')
    } finally { setSuggesting(false) }
  }

  const handlePointerDown = (key, event) => {
    event.preventDefault(); event.stopPropagation(); setSelected(key)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    move(key, event.clientX, event.clientY)
  }
  const handlePointerMove = (key, event) => { if (event.currentTarget.hasPointerCapture?.(event.pointerId)) move(key, event.clientX, event.clientY) }
  const handlePointerUp = (event) => { event.currentTarget.releasePointerCapture?.(event.pointerId) }
  const handleResizeStart = (key, event) => {
    event.preventDefault(); event.stopPropagation(); setSelected(key)
    resizeState.current = { key, x: event.clientX, y: event.clientY, layout: { ...layout } }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const handleResizeMove = (event) => {
    const state = resizeState.current
    const surface = surfaceRef.current
    if (!state || !surface || !event.currentTarget.hasPointerCapture?.(event.pointerId)) return
    const dx = ((event.clientX - state.x) / surface.getBoundingClientRect().width) * 100
    const dy = ((event.clientY - state.y) / surface.getBoundingClientRect().height) * 100
    if (state.key === 'name' || state.key === 'number') {
      const field = state.key === 'name' ? 'name_font_size' : 'number_font_size'
      setLayout((old) => ({ ...old, [field]: Math.round(Math.max(8, Math.min(state.key === 'name' ? 120 : 60, state.layout[field] + dx * 1.4))) }))
    } else if (state.key === 'qr') {
      setLayout((old) => ({ ...old, qr_size: Number(Math.max(2, Math.min(60, state.layout.qr_size + dx)).toFixed(2)) }))
    } else {
      setLayout((old) => ({ ...old,
        [`${state.key}_width`]: Number(Math.max(2, Math.min(60, state.layout[`${state.key}_width`] + dx)).toFixed(2)),
        [`${state.key}_height`]: Number(Math.max(2, Math.min(60, state.layout[`${state.key}_height`] + dy)).toFixed(2)),
      }))
    }
  }
  const handleResizeEnd = (event) => { resizeState.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId) }


  return (
    <div className="space-y-4">
      {error && <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded p-3 text-sm">{error}</div>}
      <form onSubmit={handleConfigure} className="card space-y-4">
        <div><div className="eyebrow">Editor tata letak sertifikat</div><h2 className="font-serif font-bold text-lg text-ink-900 mt-1">Atur nomor, nama, dan barcode tanda tangan</h2><p className="text-sm text-ink-500 mt-1">{loadingConfig ? 'Memuat konfigurasi tersimpan...' : 'Posisi memakai persen dari template, sehingga pratinjau dan PDF tetap sejajar.'}</p></div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="label">Template sertifikat<input className="input mt-1" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0], 'template', setTemplateImage, setTemplatePreview)} /></label>
          <label className="label">Barcode/gambar tanda tangan<input className="input mt-1" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0], 'signature', setSignatureImage, setSignaturePreview)} /></label>
        </div>
        <div className="flex flex-wrap gap-2 items-center"><button type="button" onClick={handleSuggest} disabled={suggesting || loadingConfig} className="btn-outline">{suggesting ? 'Menganalisis...' : 'Sarankan posisi otomatis'}</button>{suggestionNote && <span className="text-xs text-ink-500 max-w-xl">{suggestionNote}</span>}</div>
        <label className="label">Nomor bersama (opsional)<input className="input mt-1" value={certificateNumber} onChange={(e) => setCertificateNumberValue(e.target.value)} placeholder="Contoh: 001/SERT/2026" /></label>
        <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs text-ink-500 mb-2">Klik nama, nomor, QR, atau tanda tangan. Geser kotaknya untuk memindahkan; tarik titik di pojok kanan-bawah untuk memperbesar atau memperkecil. QR contoh hanya penanda bila belum ada sertifikat peserta.</p><div ref={surfaceRef} className="relative mx-auto overflow-hidden bg-white border" style={{ maxWidth: 760, aspectRatio: `${templateRatio} / 1` }}>
          {templatePreview ? <img src={templatePreview} alt="Pratinjau template" onLoad={(e) => e.currentTarget.naturalHeight && setTemplateRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} className="absolute inset-0 w-full h-full object-fill pointer-events-none" /> : <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">Unggah template untuk melihat pratinjau</div>}
          <PreviewBox label="NAMA PESERTA" keyName="name" x={layout.name_position_x} y={layout.name_position_y} selected={selected === 'name'} fontSize={layout.name_font_size} surfaceRef={surfaceRef} onPointerDown={(e) => handlePointerDown('name', e)} onPointerMove={(e) => handlePointerMove('name', e)} onPointerUp={handlePointerUp} onResizeStart={(e) => handleResizeStart('name', e)} onResizeMove={handleResizeMove} onResizeEnd={handleResizeEnd} />
          <PreviewBox label="NOMOR SERTIFIKAT" keyName="number" x={layout.number_position_x} y={layout.number_position_y} selected={selected === 'number'} fontSize={layout.number_font_size} surfaceRef={surfaceRef} onPointerDown={(e) => handlePointerDown('number', e)} onPointerMove={(e) => handlePointerMove('number', e)} onPointerUp={handlePointerUp} onResizeStart={(e) => handleResizeStart('number', e)} onResizeMove={handleResizeMove} onResizeEnd={handleResizeEnd} />
          {!signaturePreview && <ResizeableOverlay image={certs.find((c) => c.qr_code)?.qr_code} label="QR verifikasi peserta (contoh)" keyName="qr" x={layout.qr_position_x} y={layout.qr_position_y} width={layout.qr_size} height={layout.qr_size} square selected={selected === 'qr'} onPointerDown={(e) => handlePointerDown('qr', e)} onPointerMove={(e) => handlePointerMove('qr', e)} onPointerUp={handlePointerUp} onResizeStart={(e) => handleResizeStart('qr', e)} onResizeMove={handleResizeMove} onResizeEnd={handleResizeEnd} />}
          {signaturePreview && <ResizeableOverlay image={signaturePreview} label="Barcode/tanda tangan" keyName="signature" x={layout.signature_position_x} y={layout.signature_position_y} width={layout.signature_width} height={layout.signature_height} selected={selected === 'signature'} onPointerDown={(e) => handlePointerDown('signature', e)} onPointerMove={(e) => handlePointerMove('signature', e)} onPointerUp={handlePointerUp} onResizeStart={(e) => handleResizeStart('signature', e)} onResizeMove={handleResizeMove} onResizeEnd={handleResizeEnd} />}</div><details className="mt-3 text-sm"><summary className="cursor-pointer text-ink-500">Pengaturan angka lanjutan (opsional)</summary><div className="grid md:grid-cols-3 gap-3 mt-3"><PositionInput label="Nama X (%)" value={layout.name_position_x} onChange={(v) => setLayoutValue('name_position_x', v)} /><PositionInput label="Nama Y (%)" value={layout.name_position_y} onChange={(v) => setLayoutValue('name_position_y', v)} /><PositionInput label="Nomor X (%)" value={layout.number_position_x} onChange={(v) => setLayoutValue('number_position_x', v)} /><PositionInput label="Nomor Y (%)" value={layout.number_position_y} onChange={(v) => setLayoutValue('number_position_y', v)} /><PositionInput label="QR X (%)" value={layout.qr_position_x} onChange={(v) => setLayoutValue('qr_position_x', v)} /><PositionInput label="QR Y (%)" value={layout.qr_position_y} onChange={(v) => setLayoutValue('qr_position_y', v)} /><PositionInput label="Tanda tangan X (%)" value={layout.signature_position_x} onChange={(v) => setLayoutValue('signature_position_x', v)} /><PositionInput label="Tanda tangan Y (%)" value={layout.signature_position_y} onChange={(v) => setLayoutValue('signature_position_y', v)} /></div></details></div>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} /> Terapkan nomor ke semua sertifikat</label>
        <button type="submit" disabled={saving || loadingConfig} className="btn-primary"><Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan tata letak & buat pratinjau'}</button>
      </form>
    </div>
  )
}

function PositionInput({ label, value, onChange }) {
  return <label className="label">{label}<input className="input mt-1" type="number" step="0.01" min="0" max="100" value={value ?? 0} onChange={(e) => onChange(e.target.value)} /></label>
}

function PreviewBox({ label, x, y, selected, fontSize, surfaceRef, onPointerDown, onPointerMove, onPointerUp, onResizeStart, onResizeMove, onResizeEnd }) {
  const [displaySize, setDisplaySize] = useState(10)
  useEffect(() => {
    const update = () => {
      const surface = surfaceRef.current
      if (!surface) return
      // PDF uses A4 landscape (841.89 pt wide), not the uploaded image's pixel width.
      const scale = surface.clientWidth / 841.89
      setDisplaySize(Math.max(6, Number(fontSize || 12) * scale))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [fontSize, surfaceRef])
  return <div className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed bg-white/75 px-2 py-1 font-bold cursor-move touch-none ${selected ? 'border-brand-700 text-brand-900' : 'border-slate-400 text-slate-700'}`} style={{ left: `${x}%`, top: `${y}%`, fontSize: `${displaySize}px` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{label}{selected && <ResizeHandle onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} />}</div>
}

function ResizeableOverlay({ image, label, x, y, width, height, square, selected, onPointerDown, onPointerMove, onPointerUp, onResizeStart, onResizeMove, onResizeEnd }) {
  return <div className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none ${selected ? 'border-2 border-emerald-600' : 'border border-emerald-400'}`} style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, ...(square ? { aspectRatio: '1 / 1' } : { height: `${height}%` }) }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{image ? <img src={image} alt={label} className="w-full h-full object-contain pointer-events-none" /> : <div className="w-full h-full bg-white flex items-center justify-center text-[9px] text-slate-700">QR contoh</div>}{selected && <ResizeHandle onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} />}</div>
}

function ResizeHandle({ onPointerDown, onPointerMove, onPointerUp }) {
  return <span aria-label="Ubah ukuran" className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-brand-700 border-2 border-white cursor-nwse-resize touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
}
