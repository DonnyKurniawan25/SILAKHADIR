import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Award, FileText,
  Settings, LogOut, ClipboardList, Users, User
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'

const MENU_MAIN = [
  { to: '/admin', label: 'Dasbor', icon: LayoutDashboard, end: true },
  { to: '/admin/kegiatan', label: 'Kegiatan', icon: Calendar, adminOnly: true },
  { to: '/admin/sertifikat', label: 'Sertifikat', icon: Award },
  { to: '/admin/laporan', label: 'Laporan', icon: FileText, adminOnly: true },
  { to: '/admin/kinerja', label: 'Kinerja', icon: ClipboardList },
]

const MENU_SYSTEM = [
  { to: '/admin/pengguna', label: 'Pengguna', icon: Users, adminOnly: true },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings, adminOnly: true },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const { setting } = useBranding()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const renderItem = (m) => (
    <NavLink
      key={m.to}
      to={m.to}
      end={m.end}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xs text-sm transition ${
          isActive
            ? 'bg-brand-800 text-white font-semibold'
            : 'text-ink-700 hover:bg-slate-100'
        }`
      }
    >
      <m.icon className="w-4 h-4" />
      {m.label}
    </NavLink>
  )

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex-col
                    transform transition-transform lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'} flex`}
      >
        <div className="h-[68px] flex items-center gap-3 px-4 border-b border-slate-200 flex-shrink-0">
          {setting?.logo_url ? (
            <img src={setting.logo_url} alt="logo" className="w-10 h-10 object-contain" />
          ) : (
            <div className="w-10 h-10 rounded bg-brand-800 text-white flex items-center justify-center font-serif font-extrabold">
              S
            </div>
          )}
          <div className="min-w-0">
            <div className="font-serif font-bold text-ink-900 leading-tight truncate">
              {setting?.app_name || 'SILAKHADIR'}
            </div>
            <div className="text-[11px] text-ink-500 leading-tight truncate">
              Panel Administrasi
            </div>
          </div>
        </div>
        <div className="gov-divider" />

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold px-3 mb-2">
            Menu Utama
          </div>
          <div className="space-y-0.5">
            {MENU_MAIN.filter((m) => !m.adminOnly || user?.role !== 'operator').map(renderItem)}
          </div>

          {MENU_SYSTEM.some((m) => !m.adminOnly || user?.role !== 'operator') && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold px-3 mt-5 mb-2">
                Sistem
              </div>
              <div className="space-y-0.5">
                {MENU_SYSTEM.filter((m) => !m.adminOnly || user?.role !== 'operator').map(renderItem)}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wider text-ink-500">Masuk sebagai</div>
            <div className="text-sm font-semibold text-ink-900 truncate">{user?.username}</div>
            <div className="text-[11px] text-brand-700 uppercase tracking-wider">
              {user?.role === 'superadmin' ? 'Super Administrator'
                : user?.role === 'admin' ? 'Administrator'
                : 'Operator'}
            </div>
          </div>
          <button onClick={() => { onClose(); navigate('/admin/profil') }}
                  className="w-full btn text-brand-700 hover:bg-brand-50 justify-start !px-2 mb-1">
            <User className="w-4 h-4" /> Edit Profil Saya
          </button>
          <button onClick={handleLogout}
                  className="w-full btn text-ink-700 hover:bg-slate-100 justify-start !px-2">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
