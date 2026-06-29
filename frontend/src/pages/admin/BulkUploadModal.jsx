import { useRef, useState } from 'react'
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle,
  FileQuestion, Loader2, Trash2, PlayCircle, Search,
} from 'lucide-react'
import Swal from 'sweetalert2'
import ModalForm from '../../components/ModalForm'
import { bulkUploadCertificates } from '../../api/certificateApi'

export default function BulkUploadModal({ open, onClose, eventId, onUploaded }) {
  const [files, setFiles] = useState([])
  const [results, setResults] = useState(null)
  const [mode, setMode] = useState('idle') // idle | scanning | uploading | done
  const [createMissing, setCreateMissing] = useState(false)
  const inputRef = useRef(null)

  const reset = () => {
    setFiles([])
    setResults(null)
    setMode('idle')
    setCreateMissing(false)
  }

  const handleClose = () => {
    reset()
    onClose?.()
  }

  const handlePickFiles = (e) => {
    const list = Array.from(e.target.files || []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf'))
    setFiles((prev) => {
      const names = new Set(prev.map((p) => p.name + p.size))
      const add = list.filter((f) => !names.has(f.name + f.size))
      return [...prev, ...add]
    })
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const list = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf'))
    setFiles((prev) => [...prev, ...list])
  }

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const runScan = async () => {
    if (!files.length) return
    setMode('scanning')
    try {
      const { data } = await bulkUploadCertificates(eventId, {
        files, dryRun: true, createMissing,
      })
      setResults(data)
      setMode('idle')
    } catch (e) {
      setMode('idle')
      Swal.fire({ icon: 'error', title: 'Gagal scan', text: e?.response?.data?.detail || 'Error' })
    }
  }

  const runCommit = async () => {
    if (!files.length) return
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'Upload semua sertifikat?',
      text: `${files.length} file akan diproses. Lanjutkan?`,
      showCancelButton: true,
      confirmButtonText: 'Ya, upload',
    })
    if (!isConfirmed) return
    setMode('uploading')
    try {
      const { data } = await bulkUploadCertificates(eventId, {
        files, dryRun: false, createMissing,
      })
      setResults(data)
      setMode('done')
      Swal.fire({
        icon: 'success',
        title: 'Upload selesai',
        text: `${data.ok} sertifikat berhasil, ${data.failed} gagal/dilewati.`,
      })
      onUploaded?.()
    } catch (e) {
      setMode('idle')
      Swal.fire({ icon: 'error', title: 'Gagal upload', text: e?.response?.data?.detail || 'Error' })
    }
  }

  const statusPill = (st) => {
    const map = {
      uploaded: { cls: 'badge-green', Icon: CheckCircle2, label: 'Terupload' },
      ready: { cls: 'badge-blue', Icon: CheckCircle2, label: 'Siap upload' },
      unmatched: { cls: 'badge-yellow', Icon: FileQuestion, label: 'Tak cocok' },
      no_number: { cls: 'badge-yellow', Icon: AlertCircle, label: 'Tanpa nomor' },
      failed: { cls: 'badge-red', Icon: AlertCircle, label: 'Gagal' },
      pending: { cls: 'badge-gray', Icon: Loader2, label: 'Menunggu' },
    }
    const m = map[st] || map.pending
    return (
      <span className={`${m.cls} inline-flex items-center gap-1`}>
        <m.Icon className="w-3 h-3" /> {m.label}
      </span>
    )
  }

  return (
    <ModalForm open={open} onClose={handleClose}
               title="Bulk Upload Sertifikat" maxWidth="max-w-4xl">
      <div className="space-y-4">
        {/* Dropzone */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-pointer hover:border-brand-500 hover:bg-brand-50"
        >
          <UploadCloud className="w-10 h-10 text-slate-400" />
          <div className="font-semibold text-slate-700">
            Drop file PDF di sini, atau klik untuk pilih
          </div>
          <div className="text-xs text-slate-500">
            Banyak file sekaligus - sistem akan mencocokkan nama peserta & nomor sertifikat otomatis
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handlePickFiles}
          />
        </label>

        {files.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="p-3 flex items-center justify-between border-b border-slate-100">
              <div className="font-semibold text-brand-900">
                {files.length} file dipilih
              </div>
              <button onClick={() => setFiles([])}
                      className="text-xs text-rose-600 hover:underline">
                Bersihkan
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {files.map((f, i) => (
                <div key={i} className="p-2.5 flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-rose-500 hover:bg-rose-50 p-1 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
          <input type="checkbox" className="w-4 h-4 mt-0.5"
                 checked={createMissing}
                 onChange={(e) => setCreateMissing(e.target.checked)} />
          <div>
            <div className="font-semibold text-sm">Tambah peserta baru otomatis</div>
            <div className="text-xs text-slate-500">
              Jika PDF mengandung NIK yang belum terdaftar di kegiatan ini,
              sistem akan membuat data pesertanya secara otomatis.
            </div>
          </div>
        </label>

        <div className="flex flex-col md:flex-row gap-2">
          <button
            type="button"
            onClick={runScan}
            disabled={!files.length || mode === 'scanning' || mode === 'uploading'}
            className="btn-outline flex-1"
          >
            {mode === 'scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Scan & Preview
          </button>
          <button
            type="button"
            onClick={runCommit}
            disabled={!files.length || mode === 'scanning' || mode === 'uploading'}
            className="btn-primary flex-1"
          >
            {mode === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {mode === 'uploading' ? 'Mengunggah...' : 'Upload Semua'}
          </button>
        </div>

        {results && (
          <div className="card p-0 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-slate-700">
                Hasil {results.dry_run ? 'Scan' : 'Upload'}:
              </span>
              <span className="badge-green">{results.ok} OK</span>
              <span className="badge-red">{results.failed} gagal</span>
              <span className="badge-gray">Total {results.total}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Peserta Match</th>
                    <th>Nomor Sertifikat</th>
                    <th>Skor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={i}>
                      <td className="max-w-[180px] truncate" title={r.filename}>
                        {r.filename}
                      </td>
                      <td>
                        {r.matched_participant ? (
                          <div>
                            <div className="font-semibold">
                              {r.matched_participant.full_name}
                              {r.matched_participant.new && (
                                <span className="badge-blue ml-1">Baru</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {r.matched_participant.nik}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="font-mono text-xs">
                        {r.certificate_number || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="text-xs">
                        {r.matched_score
                          ? `${Math.round(r.matched_score * 100)}%`
                          : '-'}
                      </td>
                      <td>
                        <div>{statusPill(r.status)}</div>
                        {r.message && (
                          <div className="text-[11px] text-slate-500 mt-1">{r.message}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ModalForm>
  )
}
