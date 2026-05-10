import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Menu, Bell } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 h-[68px] flex items-center justify-between px-4 sticky top-0 z-20">
          <button
            className="lg:hidden p-2 rounded hover:bg-slate-100"
            onClick={() => setOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-ink-900">
                {user?.first_name || user?.username}
              </div>
              <div className="text-[11px] text-ink-500 uppercase tracking-wider">
                {user?.role === 'superadmin' ? 'Super Administrator'
                  : user?.role === 'admin' ? 'Administrator'
                  : 'Operator'}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-serif font-bold">
              {(user?.first_name || user?.username || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
