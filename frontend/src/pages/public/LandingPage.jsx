import { Link } from 'react-router-dom'
import {
  CalendarCheck, FileCheck2, ShieldCheck, QrCode,
  Users2, BarChart3, Award, ChevronRight, Phone, MapPin, Mail,
} from 'lucide-react'
import { useBranding } from '../../context/BrandingContext'
import LatestNews from '../../components/LatestNews'

export default function LandingPage() {
  const { setting } = useBranding()

  const features = [
    { icon: CalendarCheck, title: 'Absensi Daring', desc: 'Peserta kegiatan dapat mengisi daftar hadir secara daring melalui tautan atau pindai kode QR.' },
    { icon: Award, title: 'Penerbitan Sertifikat', desc: 'Sertifikat digital diterbitkan untuk setiap peserta yang telah mengikuti kegiatan.' },
    { icon: QrCode, title: 'Verifikasi Keaslian', desc: 'Setiap lembar sertifikat dilengkapi QR code untuk pengecekan keaslian oleh pihak manapun.' },
    { icon: Users2, title: 'Pengelolaan Peserta', desc: 'Data peserta dapat dikelola, diimpor dari berkas Excel, maupun diekspor oleh admin.' },
    { icon: BarChart3, title: 'Laporan Kegiatan', desc: 'Rekap kehadiran dan sertifikat dapat diunduh dalam format Excel atau PDF.' },
    { icon: ShieldCheck, title: 'Keamanan Data', desc: 'Seluruh akses menggunakan autentikasi berbasis peran dan tautan unduhan bertoken.' },
  ]

  const steps = [
    { n: 1, title: 'Penyelenggara membuat kegiatan', desc: 'Admin memasukkan judul, jadwal, lokasi, dan penyelenggara kegiatan.' },
    { n: 2, title: 'Tautan absensi dibagikan', desc: 'Tautan atau poster QR diedarkan kepada peserta.' },
    { n: 3, title: 'Peserta mengisi kehadiran', desc: 'Formulir diisi dengan NIK/NIP dan data diri.' },
    { n: 4, title: 'Sertifikat dikeluarkan', desc: 'Admin mengunggah sertifikat yang telah ditandatangani.' },
    { n: 5, title: 'Peserta mengunduh sertifikat', desc: 'Pengecekan dan unduhan dilakukan melalui laman publik.' },
  ]

  return (
    <div>
      {/* TOP BAR - informasi kontak ringkas */}
      <div className="bg-brand-900 text-brand-100 text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap justify-between gap-x-6 gap-y-1">
          <div className="flex items-center gap-4">
            {setting?.address && (
              <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {setting.address}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Bahasa: Indonesia</span>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="relative bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-3">
            <div className="eyebrow mb-3">Sistem Informasi Resmi</div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-extrabold text-ink-900 leading-[1.1] tracking-tight">
              {setting?.app_name || 'SILAKHADIR'}
            </h1>
            <p className="mt-4 text-lg md:text-xl text-brand-800 font-semibold">
              {setting?.tagline || 'Sistem Informasi Layanan Absensi dan Sertifikat Digital'}
            </p>
            <p className="mt-4 text-ink-700 max-w-xl leading-relaxed">
              Portal layanan publik untuk pencatatan kehadiran kegiatan serta penerbitan
              dan verifikasi sertifikat digital. Dikelola oleh{' '}
              <span className="font-semibold text-ink-900">
                {setting?.institution_name || 'instansi pemerintah'}
              </span>.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/cek-sertifikat" className="btn-primary">
                <FileCheck2 className="w-4 h-4" /> Cek Sertifikat Saya
              </Link>
            </div>
          </div>

          {/* Logo instansi besar */}
          <div className="md:col-span-2 flex justify-center md:justify-end">
            <div className="flex flex-col items-center text-center">
              {setting?.logo_url && (
                <img src={setting.logo_url} alt="Logo Instansi"
                     className="w-40 h-40 md:w-56 md:h-56 object-contain" />
              )}
              <div className="mt-3 font-serif font-bold text-ink-900 uppercase tracking-wider text-sm">
                {setting?.institution_name || 'Instansi Pemerintah'}
              </div>
            </div>
          </div>
        </div>
        <div className="gov-divider" />
      </section>

      {/* LAYANAN */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6 border-b border-slate-200 pb-3">
          <div>
            <div className="eyebrow">Layanan</div>
            <h2 className="section-title mt-1">Fitur yang Tersedia</h2>
          </div>
          <p className="text-sm text-ink-500 max-w-md">
            Layanan terintegrasi untuk mempermudah pengelolaan kegiatan dan dokumentasi kehadiran.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-0 border border-slate-200 rounded bg-white">
          {features.map((f, idx) => (
            <div
              key={f.title}
              className={`p-6 ${idx % 3 !== 2 ? 'lg:border-r border-slate-200' : ''}
                          ${idx < features.length - (features.length % 3 || 3) ? 'border-b' : ''} border-slate-200`}
            >
              <div className="w-10 h-10 rounded bg-brand-50 text-brand-800 flex items-center justify-center">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-lg text-ink-900 mt-4">{f.title}</h3>
              <p className="text-sm text-ink-700 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BERITA TERBARU */}
      <LatestNews />

      {/* ALUR */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-2xl">
            <div className="eyebrow">Tata Cara</div>
            <h2 className="section-title mt-1">Alur Penggunaan Sistem</h2>
            <p className="text-sm text-ink-500 mt-2">
              Tahapan yang perlu dilalui oleh penyelenggara dan peserta kegiatan.
            </p>
          </div>
          <ol className="mt-8 grid md:grid-cols-5 gap-0 border-t border-slate-200">
            {steps.map((s, i) => (
              <li key={s.n}
                  className={`p-5 ${i !== steps.length - 1 ? 'md:border-r' : ''} border-slate-200`}>
                <div className="text-3xl font-serif font-extrabold text-gold-500 leading-none">
                  {String(s.n).padStart(2, '0')}
                </div>
                <h3 className="mt-3 font-semibold text-ink-900 text-sm leading-snug">
                  {s.title}
                </h3>
                <p className="mt-1 text-xs text-ink-500 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="border border-slate-200 rounded bg-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="max-w-xl">
            <div className="eyebrow">Untuk Peserta</div>
            <h3 className="font-serif text-2xl md:text-3xl font-bold text-ink-900 mt-1">
              Telah mengikuti kegiatan?
            </h3>
            <p className="text-ink-700 mt-2">
              Gunakan NIK atau NIP untuk memeriksa dan mengunduh sertifikat kegiatan yang telah Anda ikuti.
            </p>
          </div>
          <Link to="/cek-sertifikat" className="btn-primary whitespace-nowrap">
            Cek Sertifikat <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
