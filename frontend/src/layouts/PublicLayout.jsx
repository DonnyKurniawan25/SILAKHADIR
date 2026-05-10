import { Outlet, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useBranding } from '../context/BrandingContext'

export default function PublicLayout() {
  const { setting } = useBranding()

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet context={{ setting }} />
      </main>

      <footer className="bg-brand-900 text-brand-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-12 gap-8 text-sm">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              {setting?.logo_url && (
                <img src={setting.logo_url} alt="logo" className="w-12 h-12 object-contain" />
              )}
              <div>
                <div className="font-serif font-bold text-white">
                  {setting?.app_name || 'SILAKHADIR'}
                </div>
                <div className="text-xs text-brand-200">
                  {setting?.tagline || 'Absensi dan Sertifikat Digital'}
                </div>
              </div>
            </div>
            <p className="mt-4 text-brand-200 leading-relaxed">
              Portal layanan publik yang dikelola oleh{' '}
              <span className="font-semibold text-white">
                {setting?.institution_name || 'instansi pemerintah'}
              </span>.
              {setting?.address && ` Berkedudukan di ${setting.address}.`}
            </p>
          </div>

          <div className="md:col-span-3">
            <div className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">
              Navigasi
            </div>
            <ul className="space-y-2 text-brand-200">
              <li><Link to="/" className="hover:text-white">Beranda</Link></li>
              <li><Link to="/cek-sertifikat" className="hover:text-white">Cek Sertifikat</Link></li>
              <li><Link to="/login" className="hover:text-white">Masuk Admin</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">
              Layanan
            </div>
            <ul className="space-y-2 text-brand-200">
              <li>Pencatatan Kehadiran Daring</li>
              <li>Penerbitan Sertifikat Digital</li>
              <li>Verifikasi Keaslian via QR Code</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-brand-300 flex flex-col md:flex-row justify-between gap-2">
            <div>© {new Date().getFullYear()} {setting?.institution_name || 'Pemerintah Daerah'}. Hak cipta dilindungi.</div>
            <div>Versi 1.0</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
