import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Search, Download, QrCode, Loader2, Calendar, Building2, FileText } from 'lucide-react'
import { checkCertificate } from '../../api/certificateApi'

export default function CheckCertificate() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()
  const [result, setResult] = useState(null)

  const onSubmit = async (data) => {
    try {
      const { data: resp } = await checkCertificate(data.nik.trim())
      setResult(resp)
    } catch {
      setResult({ found: false, message: 'Terjadi kesalahan. Silakan coba kembali.' })
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Breadcrumb + judul */}
      <nav className="text-xs text-ink-500 mb-3">
        <span>Beranda</span> <span className="mx-1.5">/</span>
        <span className="text-ink-900 font-semibold">Cek Sertifikat</span>
      </nav>
      <div className="border-b border-slate-200 pb-4 mb-6">
        <div className="eyebrow">Layanan Publik</div>
        <h1 className="section-title mt-1">Pengecekan Sertifikat Kegiatan</h1>
        <p className="text-ink-500 text-sm mt-1">
          Masukkan Nomor Induk Kependudukan (NIK) untuk memeriksa sertifikat yang tersedia.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <label className="label">Nomor NIK</label>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            className="input"
            inputMode="numeric"
            placeholder="Contoh: 5201012345678901"
            maxLength={16}
            {...register('nik', { required: true })}
          />
          <button type="submit" disabled={isSubmitting} className="btn-primary whitespace-nowrap">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isSubmitting ? 'Memproses' : 'Cari Sertifikat'}
          </button>
        </div>
        <p className="text-xs text-ink-500 mt-2">
          Data yang Anda masukkan hanya digunakan untuk pencarian sertifikat dan tidak disimpan oleh sistem.
        </p>
      </form>

      {result && (
        <div className="mt-6">
          {!result.found ? (
            <div className="border border-amber-200 bg-amber-50 rounded p-5 flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900">Sertifikat belum tersedia</div>
                <p className="text-sm text-amber-800 mt-1">
                  {result.message || 'Data yang Anda masukkan tidak ditemukan, atau sertifikat untuk NIK tersebut belum diterbitkan.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                <h2 className="font-serif font-bold text-ink-900">
                  Hasil Pencarian
                </h2>
                <span className="text-sm text-ink-500">
                  Ditemukan <span className="font-semibold text-ink-900">{result.count}</span> sertifikat
                </span>
              </div>

              <div className="space-y-0 border border-slate-200 rounded bg-white">
                {result.results.map((c, i) => (
                  <div key={c.id}
                       className={`p-5 flex flex-col md:flex-row md:items-center gap-5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <div className="eyebrow">No. Sertifikat</div>
                        <code className="font-mono text-sm font-bold text-ink-900 break-all">
                          {c.certificate_number}
                        </code>
                      </div>
                      <div className="mt-2 font-serif font-bold text-lg text-ink-900">
                        {c.event_title}
                      </div>
                      <div className="text-sm text-ink-700">
                        Atas nama <span className="font-semibold">{c.participant_name}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(c.event_start).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'long', year: 'numeric',
                          })}
                          {c.event_end && ` s.d. ${new Date(c.event_end).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                        </span>
                        {c.organizer && (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" /> {c.organizer}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row md:flex-col gap-2 md:w-44 md:flex-shrink-0">
                      <a href={c.download_url} className="btn-primary flex-1">
                        <Download className="w-4 h-4" /> Unduh PDF
                      </a>
                      <a href={c.verify_url} target="_blank" rel="noreferrer" className="btn-outline flex-1">
                        <QrCode className="w-4 h-4" /> Verifikasi
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
