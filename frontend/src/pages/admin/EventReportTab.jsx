import { useEffect, useRef, useState } from 'react'
import {
  Save, Upload, Trash2, Plus, FileText, ExternalLink,
  Image as ImageIcon, Newspaper, Paperclip, Loader2, Download,
  FileDown,
} from 'lucide-react'
import Swal from 'sweetalert2'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import ClassicEditor from '@ckeditor/ckeditor5-build-classic'
import {
  getEventReport, updateEventReport,
  uploadReportPhotos, deleteReportPhoto, updateReportPhoto,
  addReportLink, deleteReportLink,
  addReportAttachment, deleteReportAttachment, updateReportAttachment,
} from '../../api/reportDetailApi'
import { downloadAuthed } from '../../utils/download'
import { API_URL } from '../../api/axios'

export default function EventReportTab({ eventId }) {
  const [report, setReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    summary: '', notulen: '', outcome: '',
    author_name: '', author_position: '',
  })

  const load = async () => {
    const { data } = await getEventReport(eventId)
    setReport(data)
    setForm({
      summary: data.summary || '',
      notulen: data.notulen || '',
      outcome: data.outcome || '',
      author_name: data.author_name || '',
      author_position: data.author_position || '',
    })
  }

  useEffect(() => { load() }, [eventId])

  const saveMain = async () => {
    setSaving(true)
    try {
      const { data } = await updateEventReport(eventId, form)
      setReport(data)
      Swal.fire({ icon: 'success', title: 'Laporan disimpan', timer: 1200, showConfirmButton: false })
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e?.response?.data?.detail || 'Error' })
    } finally {
      setSaving(false)
    }
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center py-10 text-ink-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Memuat laporan...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ------ COVER LAPORAN ------ */}
      <CoverSection eventId={eventId} coverUrl={report.cover_image_url} onChange={load} />

      {/* ------ TOMBOL EXPORT ------ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white rounded p-3">
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <FileDown className="w-4 h-4 text-brand-700" />
          Unduh laporan yang sudah disimpan sebagai:
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadAuthed(
              `${API_URL}/events/${eventId}/report/export/?type=docx`,
              `laporan-kegiatan.docx`,
            )}
            className="btn-outline"
          >
            <Download className="w-4 h-4" /> Unduh DOCX
          </button>
          <button
            type="button"
            onClick={() => downloadAuthed(
              `${API_URL}/events/${eventId}/report/export/?type=pdf`,
              `laporan-kegiatan.pdf`,
            )}
            className="btn-primary"
          >
            <Download className="w-4 h-4" /> Unduh PDF
          </button>
        </div>
      </div>

      {/* ------ NOTULEN ------ */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
          <div>
            <div className="eyebrow flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Laporan Utama
            </div>
            <h3 className="font-bold text-ink-900 mt-0.5">Notulen & Ringkasan Kegiatan</h3>
          </div>
          <button onClick={saveMain} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Laporan'}
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Nama Penyusun</label>
            <input className="input" value={form.author_name}
                   onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Jabatan Penyusun</label>
            <input className="input" value={form.author_position}
                   onChange={(e) => setForm({ ...form, author_position: e.target.value })} />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Ringkasan Pelaksanaan</label>
            <textarea rows={3} className="input" value={form.summary}
                      onChange={(e) => setForm({ ...form, summary: e.target.value })}
                      placeholder="Gambaran singkat jalannya kegiatan..." />
          </div>
          <div>
            <label className="label">Notulen / Catatan</label>
            <div className="ck-wrapper border border-slate-300 rounded">
              <CKEditor
                editor={ClassicEditor}
                data={form.notulen}
                config={{
                  toolbar: [
                    'heading', '|',
                    'bold', 'italic', 'underline', '|',
                    'bulletedList', 'numberedList', '|',
                    'blockQuote', 'link', '|',
                    'undo', 'redo',
                  ],
                  language: 'id',
                }}
                onChange={(_, editor) => setForm({ ...form, notulen: editor.getData() })}
              />
            </div>
            <p className="text-xs text-ink-500 mt-1">
              Format lengkap dapat diubah lewat toolbar. Bisa heading, daftar, kutipan, dan tautan.
            </p>
          </div>
          <div>
            <label className="label">Tindak Lanjut / Rekomendasi</label>
            <textarea rows={3} className="input" value={form.outcome}
                      onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                      placeholder="Rencana aksi selanjutnya..." />
          </div>
        </div>
      </div>

      {/* ------ FOTO ------ */}
      <PhotosSection eventId={eventId} photos={report.photos} onChange={load} />

      {/* ------ LINK BERITA ------ */}
      <LinksSection eventId={eventId} links={report.links} onChange={load} />

      {/* ------ LAMPIRAN ------ */}
      <AttachmentsSection eventId={eventId} attachments={report.attachments} onChange={load} />
    </div>
  )
}

/* ---------------- FOTO ---------------- */
function PhotosSection({ eventId, photos, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const handlePick = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      await uploadReportPhotos(eventId, files)
      onChange?.()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal unggah', text: err?.response?.data?.detail || 'Error' })
    } finally { setBusy(false) }
  }

  const handleDelete = async (photo) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning', title: 'Hapus foto?',
      showCancelButton: true, confirmButtonColor: '#d32f2f',
    })
    if (!isConfirmed) return
    await deleteReportPhoto(eventId, photo.id)
    onChange?.()
  }

  const handleCaption = async (photo) => {
    const { value } = await Swal.fire({
      title: 'Keterangan foto',
      input: 'text',
      inputValue: photo.caption || '',
      showCancelButton: true,
    })
    if (value === undefined) return
    await updateReportPhoto(eventId, photo.id, { caption: value })
    onChange?.()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Dokumentasi
          </div>
          <h3 className="font-bold text-ink-900 mt-0.5">Foto Kegiatan ({photos.length})</h3>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple
               className="hidden" onChange={handlePick} />
        <button onClick={() => inputRef.current?.click()} disabled={busy}
                className="btn-primary">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Unggah Foto
        </button>
      </div>
      {photos.length === 0 ? (
        <div className="text-center py-8 text-ink-500 text-sm">
          Belum ada foto. Klik "Unggah Foto" untuk menambahkan.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group border border-slate-200 rounded overflow-hidden bg-slate-50">
              <img src={p.image_url} alt={p.caption || ''}
                   className="w-full aspect-[4/3] object-cover" />
              <div className="p-2 text-xs text-ink-700 min-h-[2.5rem]">
                {p.caption || <span className="text-ink-500 italic">Tanpa keterangan</span>}
              </div>
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => handleCaption(p)}
                        className="bg-white/95 text-brand-700 rounded px-2 py-1 text-xs font-semibold shadow">
                  Edit
                </button>
                <button onClick={() => handleDelete(p)}
                        className="bg-accent-500 text-white rounded p-1.5 shadow">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- LINK ---------------- */
function LinksSection({ eventId, links, onChange }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: '', url: '', source: '' })

  const submit = async () => {
    if (!form.label || !form.url) {
      Swal.fire({ icon: 'warning', title: 'Lengkapi judul dan URL' })
      return
    }
    await addReportLink(eventId, form)
    setForm({ label: '', url: '', source: '' })
    setAdding(false)
    onChange?.()
  }

  const remove = async (link) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning', title: 'Hapus tautan?', text: link.label,
      showCancelButton: true, confirmButtonColor: '#d32f2f',
    })
    if (!isConfirmed) return
    await deleteReportLink(eventId, link.id)
    onChange?.()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5" /> Pemberitaan
          </div>
          <h3 className="font-bold text-ink-900 mt-0.5">Lampiran Tautan Berita ({links.length})</h3>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Tambah Tautan
          </button>
        )}
      </div>

      {adding && (
        <div className="border border-brand-200 bg-brand-50/40 p-3 rounded mb-3 space-y-2">
          <div className="grid md:grid-cols-2 gap-2">
            <input className="input" placeholder="Judul / deskripsi *"
                   value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input className="input" placeholder="Nama media (opsional)"
                   value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <input className="input" placeholder="https://... *"
                 value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm({ label: '', url: '', source: '' }) }}
                    className="btn-ghost">Batal</button>
            <button onClick={submit} className="btn-primary">
              <Plus className="w-4 h-4" /> Simpan
            </button>
          </div>
        </div>
      )}

      {links.length === 0 && !adding ? (
        <div className="text-center py-8 text-ink-500 text-sm">
          Belum ada tautan berita.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {links.map((l) => (
            <li key={l.id} className="py-3 flex items-start gap-3">
              <Newspaper className="w-4 h-4 text-brand-600 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-900">{l.label}</div>
                {l.source && <div className="text-xs text-ink-500">{l.source}</div>}
                <a href={l.url} target="_blank" rel="noreferrer"
                   className="text-xs text-brand-700 hover:underline break-all inline-flex items-center gap-1 mt-0.5">
                  {l.url} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button onClick={() => remove(l)}
                      className="btn-ghost !px-2 !py-1.5 text-rose-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- LAMPIRAN ---------------- */
function AttachmentsSection({ eventId, attachments, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const handlePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { value: label, isConfirmed } = await Swal.fire({
      title: 'Judul lampiran',
      input: 'text',
      inputValue: file.name,
      showCancelButton: true,
      confirmButtonText: 'Unggah',
    })
    if (!isConfirmed) return
    setBusy(true)
    try {
      await addReportAttachment(eventId, label || file.name, file)
      onChange?.()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err?.response?.data?.detail || 'Error' })
    } finally { setBusy(false) }
  }

  const remove = async (att) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning', title: 'Hapus lampiran?', text: att.label,
      showCancelButton: true, confirmButtonColor: '#d32f2f',
    })
    if (!isConfirmed) return
    await deleteReportAttachment(eventId, att.id)
    onChange?.()
  }

  const rename = async (att) => {
    const { value } = await Swal.fire({
      title: 'Ubah judul', input: 'text', inputValue: att.label,
      showCancelButton: true,
    })
    if (value === undefined) return
    await updateReportAttachment(eventId, att.id, { label: value })
    onChange?.()
  }

  const fmtSize = (b) => {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Berkas
          </div>
          <h3 className="font-bold text-ink-900 mt-0.5">Lampiran ({attachments.length})</h3>
          <p className="text-xs text-ink-500">PDF, DOCX, XLSX, dsb. Maks 25MB per berkas.</p>
        </div>
        <input ref={inputRef} type="file" className="hidden" onChange={handlePick} />
        <button onClick={() => inputRef.current?.click()} disabled={busy}
                className="btn-primary">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Tambah Lampiran
        </button>
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-8 text-ink-500 text-sm">Belum ada lampiran.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {attachments.map((a) => (
            <li key={a.id} className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-brand-50 text-brand-700 flex items-center justify-center">
                <Paperclip className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-900 truncate">{a.label}</div>
                <div className="text-xs text-ink-500 truncate">
                  {a.file_name} · {fmtSize(a.file_size)}
                </div>
              </div>
              <a href={a.file_url} target="_blank" rel="noreferrer"
                 className="btn-outline !px-3 !py-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Buka
              </a>
              <button onClick={() => rename(a)}
                      className="btn-ghost !px-2 !py-1.5 text-xs">Ubah</button>
              <button onClick={() => remove(a)}
                      className="btn-ghost !px-2 !py-1.5 text-rose-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


/* ---------------- COVER LAPORAN ---------------- */
function CoverSection({ eventId, coverUrl, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)

  const handlePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      Swal.fire({ icon: 'warning', title: 'File harus berupa gambar' })
      return
    }
    // Preview
    setPreview(URL.createObjectURL(file))
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('cover_image', file)
      // PUT ke report endpoint
      const { default: api } = await import('../../api/axios')
      await api.put(`/events/${eventId}/report/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      Swal.fire({ icon: 'success', title: 'Cover tersimpan', timer: 1200, showConfirmButton: false })
      setPreview(null)
      onChange?.()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err?.response?.data?.detail || 'Error' })
    } finally {
      setBusy(false)
    }
  }

  const displayUrl = preview || coverUrl

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Sampul
          </div>
          <h3 className="font-bold text-ink-900 mt-0.5">Cover Laporan</h3>
          <p className="text-xs text-ink-500">
            Gambar cover ditampilkan full satu halaman A4 di awal laporan.
            Rekomendasi ukuran: 794×1123 px (A4 portrait).
          </p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
        <button onClick={() => inputRef.current?.click()} disabled={busy}
                className="btn-primary">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {coverUrl ? 'Ganti Cover' : 'Unggah Cover'}
        </button>
      </div>
      {displayUrl ? (
        <div className="border border-slate-200 rounded overflow-hidden bg-slate-50 flex justify-center">
          <img
            src={displayUrl}
            alt="Cover laporan"
            className="max-h-[400px] w-auto object-contain"
          />
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-300 rounded p-10 text-center text-ink-500 text-sm">
          Belum ada cover. Klik "Unggah Cover" untuk menambahkan.
        </div>
      )}
    </div>
  )
}
