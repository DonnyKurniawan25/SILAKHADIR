import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { verifyPublicCertificate } from '../../api/publicCertificateApi'
import { formatCertificateDates } from '../../api/publicCertificateHelpers.mjs'
import { useBranding } from '../../context/BrandingContext'

export default function VerifyCertificate() {
  const { token } = useParams()
  const { setting } = useBranding()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setData(null)
    setError('')
    verifyPublicCertificate(token)
      .then((r) => { if (active) setData(r.data) })
      .catch(() => { if (active) setError('Pemeriksaan gagal. Periksa koneksi Anda dan muat ulang halaman ini.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-ink-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Memeriksa keabsahan sertifikat...
      </div>
    )
  }

  if (error) return <div className="max-w-3xl mx-auto px-4 py-10"><p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">{error}</p></div>

  return <CertificateVerificationResult data={data} setting={setting} />
}

export function CertificateVerificationResult({ data, setting }) {
  const isValid = data?.valid === true
  const hasCertificate = Boolean(data?.event_title || data?.certificate_number)
  const isRevoked = data?.status === 'dicabut' || data?.status === 'revoked'
  const isProcessing = hasCertificate && !isValid && !isRevoked

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-xs text-ink-500 mb-3">
        Beranda <span className="mx-1.5">/</span>
        <span className="text-ink-900 font-semibold">Verifikasi Sertifikat</span>
      </nav>

      <div className="border border-slate-200 rounded bg-white overflow-hidden">
        {/* Kop surat */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-4">
          {setting?.logo_url && (
            <img src={setting.logo_url} alt="logo" className="w-14 h-14 object-contain" />
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-500">
              {setting?.institution_name ? 'Pemerintah Daerah' : 'Instansi Pemerintah'}
            </div>
            <div className="font-serif font-bold text-ink-900 leading-tight">
              {setting?.institution_name || 'SILAKHADIR'}
            </div>
            {setting?.address && (
              <div className="text-xs text-ink-500">{setting.address}</div>
            )}
          </div>
        </div>
        <div className="gov-divider" />

        {/* Isi */}
        <div className="p-7">
          <div className={`flex items-center gap-3 pb-4 border-b border-slate-200
                          ${isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isValid
              ? <ShieldCheck className="w-6 h-6 flex-shrink-0" />
              : <ShieldAlert className="w-6 h-6 flex-shrink-0" />}
            <div>
              <h1 className="font-serif font-bold text-xl text-ink-900">
                {isValid ? 'Sertifikat Terverifikasi' : isRevoked ? 'Sertifikat Telah Dicabut' : hasCertificate ? 'Sertifikat Menunggu Pengesahan' : 'Sertifikat Tidak Ditemukan'}
              </h1>
              <p className="text-sm text-ink-700">
                {isValid
                  ? 'Dokumen tercatat final di sistem; gambar QR/tanda tangan bukan tanda tangan elektronik tersertifikasi.'
                  : (isRevoked ? 'Sertifikat telah dicabut oleh penyelenggara dan tidak berlaku.' : hasCertificate ? 'Sertifikat belum disahkan oleh penyelenggara. Ketersediaan PDF tidak berarti sertifikat telah terverifikasi.' : data?.message || 'Sertifikat tidak terdaftar atau telah dicabut.')}
              </p>
            </div>
          </div>

          {(isValid || isProcessing) && (
            <dl className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <Row label="Nomor Sertifikat" value={data.certificate_number} span={2} mono />
              <Row label="Status" value={isProcessing ? <span className="badge-yellow">Memproses</span> : <span className="badge-green">Tersedia &amp; Sah</span>} />
              <Row label="Nama Penerima" value={data.participant_name} span={2} />
              <Row label="Penyelenggara" value={data.organizer || '-'} />
              <Row
                label="Nama Kegiatan"
                value={data.event_title}
                span={3}
              />
              <Row
                label="Tanggal Kegiatan"
                value={formatCertificateDates(data.event_start, data.event_end)}
                span={3}
              />
            </dl>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-[11px] text-ink-500">
          Halaman ini menampilkan status pencatatan sertifikat dalam sistem, bukan validasi tanda tangan elektronik tersertifikasi.
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, span = 1, mono }) {
  const cls = span === 3 ? 'md:col-span-3' : span === 2 ? 'md:col-span-2' : ''
  return (
    <div className={cls}>
      <dt className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</dt>
      <dd className={`text-sm text-ink-900 font-semibold mt-0.5 ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
