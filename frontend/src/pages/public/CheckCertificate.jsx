import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Download, QrCode, Loader2, Calendar, Building2, FileText, ShieldCheck, ShieldAlert } from 'lucide-react'
import { checkPublicCertificate, downloadPublicCertificate } from '../../api/publicCertificateApi'
import { certificateSearchParams, certificateDownloadUrl, certificateStatus, formatCertificateDates } from '../../api/publicCertificateHelpers.mjs'

export function CertificateSearchForm({ identity, onChange, onSubmit, loading, error }) {
  return <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
    <label htmlFor="certificate-identity" className="block text-sm font-semibold text-ink-900 mb-2">NIK atau NIP</label>
    <div className="flex flex-col sm:flex-row gap-3">
      <input id="certificate-identity" className="input flex-1 min-w-0" type="text" inputMode="numeric" autoComplete="off" placeholder="Masukkan NIK atau NIP Anda" maxLength={18} value={identity} onChange={onChange} aria-describedby={`identity-hint${error ? ' identity-error' : ''}`} aria-invalid={Boolean(error)} />
      <button type="submit" disabled={loading} className="btn-primary justify-center whitespace-nowrap py-3">{loading ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : <Search aria-hidden="true" className="w-4 h-4" />}{loading ? 'Mencari…' : 'Cari Sertifikat'}</button>
    </div>
    <p id="identity-hint" className="text-sm text-ink-500 mt-3">Cukup salah satu: <strong>NIK 16 digit</strong> atau <strong>NIP 18 digit</strong>. Tidak memiliki NIK? Gunakan NIP Anda.</p>
    {error && <p id="identity-error" role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </form>
}

export function CertificateCard({ certificate: c }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const status = certificateStatus(c)
  const downloadable = Boolean(certificateDownloadUrl(c))
  async function download() {
    setDownloading(true)
    setError('')
    try { await downloadPublicCertificate(c) } catch (err) { setError(err.message || 'Unduhan gagal. Silakan coba kembali.') } finally { setDownloading(false) }
  }
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row">
    <div className="relative h-44 sm:h-auto sm:min-h-[250px] sm:w-56 lg:w-64 shrink-0 overflow-hidden bg-ink-900">
      {c.thumbnail_url && !imageFailed ? <img src={c.thumbnail_url} alt={`Sampul kegiatan ${c.event_title}`} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-cover sm:absolute sm:inset-0" /> : <div className="h-full min-h-44 sm:min-h-[250px] flex flex-col justify-center items-center gap-3 bg-gradient-to-br from-ink-900 via-slate-800 to-teal-800 text-white p-6 text-center">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><FileText aria-hidden="true" className="h-9 w-9 text-amber-300" /></div>
        <span className="text-xs tracking-widest uppercase text-white/80">Sertifikat Kegiatan</span>
        <span className="text-sm font-semibold leading-snug">{c.organizer || 'SILAKHADIR'}</span>
      </div>}
    </div>
    <div className="p-5 sm:p-6 flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${status.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{status.verified ? <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5" /> : <ShieldAlert aria-hidden="true" className="w-3.5 h-3.5" />}{status.label}</span>
        <span className="text-xs text-ink-500">{downloadable ? 'PDF tersedia' : 'PDF belum tersedia'}</span>
      </div>
      <h3 className="font-serif font-bold text-xl leading-snug text-ink-900 break-words">{c.event_title}</h3>
      <p className="mt-2 text-sm text-ink-700">Atas nama <strong>{c.participant_name}</strong></p>
      <div className="mt-4 space-y-2 text-sm text-ink-500">
        <p className="flex items-start gap-2"><Calendar aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />{formatCertificateDates(c.event_start, c.event_end)}</p>
        {c.organizer && <p className="flex items-start gap-2"><Building2 aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words">{c.organizer}</span></p>}
      </div>
      <p className="mt-4 text-xs text-ink-500">No. sertifikat: <span className="font-mono text-ink-700 break-all">{c.certificate_number || 'Belum ditetapkan'}</span></p>
      {!status.verified && <p className="mt-2 text-xs text-amber-800">{downloadable ? 'PDF dapat diunduh. Pengesahan sertifikat masih menunggu penyelenggara.' : 'Sertifikat masih diproses oleh penyelenggara.'}</p>}
      <div className="flex flex-col lg:flex-row gap-2 mt-5">
        {downloadable && <button type="button" onClick={download} disabled={downloading} className="btn-primary justify-center">{downloading ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : <Download aria-hidden="true" className="w-4 h-4" />}{downloading ? 'Mengunduh…' : 'Unduh Sertifikat'}</button>}
        {c.verify_url && <a href={c.verify_url} target="_blank" rel="noopener noreferrer" className="btn-outline justify-center"><QrCode aria-hidden="true" className="w-4 h-4" />Cek keaslian<span className="sr-only"> (tab baru)</span></a>}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  </article>
}

export default function CheckCertificate() {
  const [params] = useSearchParams()
  const initial = params.get('identity') || params.get('nik') || params.get('nip') || params.get('identity_number') || ''
  const eventId = params.get('event_id')
  const [identity, setIdentity] = useState(initial)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  async function search(value) {
    const id = ++requestId.current
    setResult(null)
    setError('')
    try { certificateSearchParams(value) } catch (err) { setError(err.message); setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await checkPublicCertificate(value, eventId)
      if (id === requestId.current) setResult(data)
    } catch (err) {
      if (id === requestId.current) setError(err.response?.data?.detail || 'Pencarian gagal. Periksa koneksi Anda dan coba kembali.')
    } finally { if (id === requestId.current) setLoading(false) }
  }
  useEffect(() => {
    setIdentity(initial)
    if (initial) search(initial)
    return () => { requestId.current += 1 }
  }, [initial, eventId])
  return <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
    <nav aria-label="Breadcrumb" className="text-xs text-ink-500 mb-5"><Link to="/">Beranda</Link><span className="mx-2">/</span><span className="font-semibold text-ink-900">Cek Sertifikat</span></nav>
    <header className="mb-7"><div className="eyebrow">Layanan Publik · Sertifikat Kegiatan</div><h1 className="section-title mt-2">Temukan sertifikat Anda</h1><p className="mt-3 text-sm sm:text-base text-ink-500 max-w-2xl">Cari sertifikat kegiatan, unduh dokumen PDF, dan periksa keasliannya dalam satu tempat.</p></header>
    <CertificateSearchForm identity={identity} onChange={e => { setIdentity(e.target.value); setError('') }} onSubmit={e => { e.preventDefault(); search(identity) }} loading={loading} error={error} />
    <section aria-live="polite" aria-busy={loading} className="mt-7">
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-ink-500"><Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />Mencari sertifikat Anda…</p>}
      {result && (result.found && result.results?.length ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4"><h2 className="font-serif font-bold text-xl text-ink-900">Hasil pencarian</h2><p className="text-sm text-ink-500">{result.results.length} sertifikat ditemukan</p></div>
        <div className="space-y-5">{result.results.map(c => <CertificateCard key={c.id} certificate={c} />)}</div>
      </> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-start gap-3"><FileText aria-hidden="true" className="w-6 h-6 shrink-0 text-ink-500" /><div><h2 className="font-semibold text-ink-900">Sertifikat belum ditemukan</h2><p className="text-sm text-ink-500 mt-2">{result.message || 'Periksa NIK atau NIP Anda, atau hubungi penyelenggara kegiatan.'}</p><p className="text-sm text-ink-500 mt-2">Anda juga dapat mencoba nomor identitas lainnya jika telah terdaftar.</p></div></div>)}
    </section>
  </div>
}
