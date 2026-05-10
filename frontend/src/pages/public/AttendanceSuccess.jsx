import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, ArrowLeft, FileCheck2 } from 'lucide-react'

export default function AttendanceSuccess() {
  const { state } = useLocation()
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="border border-slate-200 rounded bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="eyebrow text-emerald-700">Berhasil</div>
            <h1 className="font-serif font-bold text-xl text-ink-900">Kehadiran Tercatat</h1>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-ink-700">
            Terima kasih{state?.name ? <>, <span className="font-semibold text-ink-900">{state.name}</span></> : ''}.
            Kehadiran Anda pada kegiatan{state?.event_title ? <> <span className="font-semibold text-ink-900">&ldquo;{state.event_title}&rdquo;</span></> : ''} telah berhasil direkam dalam sistem.
          </p>
          <p className="text-sm text-ink-500">
            Sertifikat kegiatan dapat diakses setelah penyelenggara menerbitkannya. Anda dapat memeriksa
            ketersediaan sertifikat melalui laman Cek Sertifikat menggunakan NIK atau NIP.
          </p>
        </div>
        <div className="bg-slate-50 border-t border-slate-200 p-6 flex flex-wrap gap-2">
          <Link to="/" className="btn-outline">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
          <Link to="/cek-sertifikat" className="btn-primary">
            <FileCheck2 className="w-4 h-4" /> Cek Sertifikat
          </Link>
        </div>
      </div>
    </div>
  )
}
