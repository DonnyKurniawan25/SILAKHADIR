import { Link, NavLink } from 'react-router-dom'
import { ShieldCheck, FileCheck2 } from 'lucide-react'
import { useBranding } from '../context/BrandingContext'

export default function Navbar() {
  const { setting } = useBranding()

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-[68px] flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          {setting?.logo_url ? (
            <img src={setting.logo_url} alt="logo"
                 className="w-11 h-11 object-contain flex-shrink-0" />
          ) : (
            <div className="w-11 h-11 rounded bg-brand-800 text-white flex items-center justify-center font-serif font-extrabold text-lg">
              S
            </div>
          )}
          <div className="min-w-0">
            <div className="font-serif font-bold text-ink-900 leading-tight truncate">
              {setting?.app_name || 'SILAKHADIR'}
            </div>
            <div className="text-[11px] text-ink-500 leading-tight truncate">
              {setting?.institution_name || 'Sistem Informasi Instansi Pemerintah'}
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <NavLink to="/" end
                   className={({ isActive }) => `px-3 py-2 font-semibold ${isActive ? 'text-brand-800 border-b-2 border-brand-800' : 'text-ink-700 hover:text-brand-800'}`}>
            Beranda
          </NavLink>
          <NavLink to="/cek-sertifikat"
                   className={({ isActive }) => `px-3 py-2 font-semibold ${isActive ? 'text-brand-800 border-b-2 border-brand-800' : 'text-ink-700 hover:text-brand-800'}`}>
            Cek Sertifikat
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/cek-sertifikat" className="md:hidden btn-ghost !px-3">
            <FileCheck2 className="w-4 h-4" />
          </Link>
          <Link to="/login" className="btn-primary">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Masuk</span>
          </Link>
        </div>
      </div>
      <div className="gov-divider" />
    </header>
  )
}
