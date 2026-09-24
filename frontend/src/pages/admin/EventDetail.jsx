import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Calendar, MapPin, Building2, ArrowLeft, Copy, Check,
  LockKeyhole, Award, Users2, Upload, RefreshCw, UploadCloud,
  QrCode, Printer, Download, FileText, Save, Pencil,
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
  listEventCertificates, replaceCertificateFile, configureEventCertificate,
  getEventCertificateConfig, suggestEventCertificateLayout,
  setCertificateNumber,
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

const DEFAULT_CERT_LAYOUT = {
  name_position_x: 50, name_position_y: 45, number_position_x: 50, number_position_y: 30,
  signature_position_x: 82, signature_position_y: 82, signature_width: 14, signature_height: 8,
  name_font_size: 36, number_font_size: 14,
}

function CertTab({ eventId, certs, onRefresh }) {
  const [templateImage, setTemplateImage] = useState(null)
  const [signatureImage, setSignatureImage] = useState(null)
  const [templatePreview, setTemplatePreview] = useState('')
  const [signaturePreview, setSignaturePreview] = useState('')
  const [certificateNumber, setCertificateNumberValue] = useState('')
  const [applyAll, setApplyAll] = useState(true)
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

  const handleSetNumber = async (cert) => {
    const { value } = await Swal.fire({ title: 'Ubah nomor sertifikat', input: 'text', inputValue: cert.certificate_number || '', inputLabel: 'Nomor sertifikat peserta ini', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', inputValidator: (v) => !v?.trim() && 'Nomor wajib diisi' })
    if (!value?.trim()) return
    try { await setCertificateNumber(eventId, cert.id, value.trim()); Swal.fire({ icon: 'success', title: 'Nomor disimpan', timer: 1200, showConfirmButton: false }); onRefresh?.() }
    catch (err) { Swal.fire({ icon: 'error', title: 'Gagal menyimpan nomor', text: err?.response?.data?.detail || 'Terjadi kesalahan.' }) }
  }
  const handleReplace = async (cert) => {
    const { value: file } = await Swal.fire({ title: 'Ganti Berkas PDF', text: `Nomor: ${cert.certificate_number || '-'}`, input: 'file', inputAttributes: { accept: 'application/pdf' }, showCancelButton: true, confirmButtonText: 'Unggah' })
    if (!file) return
    try { await replaceCertificateFile(eventId, cert.id, file); Swal.fire({ icon: 'success', title: 'Berkas diganti', timer: 1200, showConfirmButton: false }); onRefresh?.() }
    catch (err) { Swal.fire({ icon: 'error', title: 'Gagal', text: err?.response?.data?.detail || 'Error' }) }
  }

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
        <div className="grid md:grid-cols-3 gap-3"><label className="label">Ukuran nama (pt)<input className="input mt-1" type="number" min="8" max="120" value={layout.name_font_size} onChange={(e) => setLayoutValue('name_font_size', e.target.value)} /></label><label className="label">Ukuran nomor/barcode (pt)<input className="input mt-1" type="number" min="8" max="60" value={layout.number_font_size} onChange={(e) => setLayoutValue('number_font_size', e.target.value)} /></label><label className="label">Nomor bersama (opsional)<input className="input mt-1" value={certificateNumber} onChange={(e) => setCertificateNumberValue(e.target.value)} placeholder="Contoh: 001/SERT/2026" /></label></div>
        <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs text-ink-500 mb-2">Pilih lalu geser elemen dengan pointer. Klik latar tidak memindahkan nama.</p><div ref={surfaceRef} className="relative mx-auto overflow-hidden bg-white border" style={{ maxWidth: 760, aspectRatio: `${templateRatio} / 1` }}>
          {templatePreview ? <img src={templatePreview} alt="Pratinjau template" onLoad={(e) => e.currentTarget.naturalHeight && setTemplateRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} className="absolute inset-0 w-full h-full object-fill pointer-events-none" /> : <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">Unggah template untuk melihat pratinjau</div>}
          <PreviewBox label="NAMA PESERTA" x={layout.name_position_x} y={layout.name_position_y} selected={selected === 'name'} fontSize={layout.name_font_size} surfaceRef={surfaceRef} onPointerDown={(e) => handlePointerDown('name', e)} onPointerMove={(e) => handlePointerMove('name', e)} onPointerUp={handlePointerUp} />
          <PreviewBox label="NOMOR SERTIFIKAT" x={layout.number_position_x} y={layout.number_position_y} selected={selected === 'number'} fontSize={layout.number_font_size} surfaceRef={surfaceRef} onPointerDown={(e) => handlePointerDown('number', e)} onPointerMove={(e) => handlePointerMove('number', e)} onPointerUp={handlePointerUp} />
          {signaturePreview && <img src={signaturePreview} alt="Barcode tanda tangan" className={`absolute object-contain cursor-move ${selected === 'signature' ? 'border-2 border-emerald-600' : 'border border-emerald-400'}`} style={{ left: `${layout.signature_position_x}%`, top: `${layout.signature_position_y}%`, width: `${layout.signature_width}%`, height: `${layout.signature_height}%`, transform: 'translate(-50%, -50%)' }} onPointerDown={(e) => handlePointerDown('signature', e)} onPointerMove={(e) => handlePointerMove('signature', e)} onPointerUp={handlePointerUp} />}</div><div className="grid md:grid-cols-3 gap-3 mt-3"><PositionInput label="Nama X (%)" value={layout.name_position_x} onChange={(v) => setLayoutValue('name_position_x', v)} /><PositionInput label="Nama Y (%)" value={layout.name_position_y} onChange={(v) => setLayoutValue('name_position_y', v)} /><PositionInput label="Nomor X (%)" value={layout.number_position_x} onChange={(v) => setLayoutValue('number_position_x', v)} /><PositionInput label="Nomor Y (%)" value={layout.number_position_y} onChange={(v) => setLayoutValue('number_position_y', v)} /><PositionInput label="Tanda tangan X (%)" value={layout.signature_position_x} onChange={(v) => setLayoutValue('signature_position_x', v)} /><PositionInput label="Tanda tangan Y (%)" value={layout.signature_position_y} onChange={(v) => setLayoutValue('signature_position_y', v)} /><PositionInput label="Lebar tanda tangan (%)" value={layout.signature_width} onChange={(v) => setLayoutValue('signature_width', v)} /><PositionInput label="Tinggi tanda tangan (%)" value={layout.signature_height} onChange={(v) => setLayoutValue('signature_height', v)} /></div></div>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} /> Terapkan nomor ke semua sertifikat</label>
        <button type="submit" disabled={saving || loadingConfig} className="btn-primary"><Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan tata letak & buat pratinjau'}</button>
      </form>
      {!certs.length ? <div className="border border-slate-200 rounded bg-white p-10 text-center"><Award className="w-10 h-10 text-ink-300 mx-auto mb-2" /><p className="text-ink-500">Belum ada sertifikat.</p></div> : <div className="card p-0 overflow-hidden"><table className="table-base"><thead><tr><th>No. Sertifikat</th><th>Nama Peserta</th><th>Status</th><th className="text-right pr-4">Tindakan</th></tr></thead><tbody>{certs.map((c) => <tr key={c.id}><td className="font-mono text-xs">{c.certificate_number || '-'}</td><td className="font-semibold">{c.participant_name}</td><td><span className={c.status === 'available' ? 'badge-green' : 'badge-yellow'}>{c.status || 'Memproses'}</span></td><td className="text-right pr-4"><button onClick={() => handleSetNumber(c)} className="btn-ghost !px-2 !py-1.5 text-xs"><Pencil className="w-3.5 h-3.5" /> Nomor</button> <button onClick={() => handleReplace(c)} className="btn-ghost !px-2 !py-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" /> PDF</button>{c.pdf_url && <><a href={c.pdf_url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1.5 text-xs ml-1">Pratinjau PDF</a><a href={c.download_url || c.pdf_url} className="btn-primary !px-3 !py-1.5 text-xs ml-1">Unduh</a></>}</td></tr>)}</tbody></table></div>}
    </div>
  )
}

function PositionInput({ label, value, onChange }) {
  return <label className="label">{label}<input className="input mt-1" type="number" step="0.01" min="0" max="100" value={value ?? 0} onChange={(e) => onChange(e.target.value)} /></label>
}

function PreviewBox({ label, x, y, selected, fontSize, surfaceRef, onPointerDown, onPointerMove, onPointerUp }) {
  const [displaySize, setDisplaySize] = useState(10)
  useEffect(() => {
    const update = () => {
      const surface = surfaceRef.current
      if (!surface) return
      const image = surface.querySelector('img[alt="Pratinjau template"]')
      const nativeWidth = image?.naturalWidth || 0
      const scale = nativeWidth ? surface.clientWidth / nativeWidth : 1
      setDisplaySize(Math.max(8, Math.min(72, Number(fontSize || 12) * (96 / 72) * scale)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [fontSize, surfaceRef])
  return <button type="button" className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed bg-white/75 px-2 py-1 font-bold cursor-move touch-none ${selected ? 'border-brand-700 text-brand-900' : 'border-slate-400 text-slate-700'}`} style={{ left: `${x}%`, top: `${y}%`, fontSize: `${displaySize}px` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{label}</button>
}
