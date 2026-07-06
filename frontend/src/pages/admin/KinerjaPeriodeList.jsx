import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Plus, Users, FileText, ChevronRight,
  Lock, Unlock, Trash2, Search,
} from 'lucide-react'
import Swal from 'sweetalert2'
import { useAuth } from '../../context/AuthContext'
import { listPeriodes, deletePeriode, updatePeriode } from '../../api/kinerjaApi'

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export default function KinerjaPeriodeList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [periodes, setPeriodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i) // [currentYear-3, ..., currentYear+2]

  const load = async () => {
    setLoading(true)
    try {
      const params = { search, page_size: 100 }
      if (selectedYear) {
        params.tahun = selectedYear
      }
      const { data } = await listPeriodes(params)
      setPeriodes(data.results || data)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, selectedYear])

  const handleDelete = async (id, nama) => {
    const r = await Swal.fire({
      title: 'Hapus Periode?',
      text: `"${nama}" akan dihapus permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d32f2f',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    })
    if (!r.isConfirmed) return
    try {
      await deletePeriode(id)
      Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1200, showConfirmButton: false })
      load()
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal menghapus' })
    }
  }

  const handleToggleStatus = async (p) => {
    const newStatus = p.status === 'aktif' ? 'ditutup' : 'aktif'
    try {
      await updatePeriode(p.id, { ...p, status: newStatus })
      Swal.fire({
        icon: 'success',
        title: newStatus === 'aktif' ? 'Periode Diaktifkan' : 'Periode Ditutup',
        timer: 1200, showConfirmButton: false,
      })
      load()
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal mengubah status' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="eyebrow">Kinerja ASN</div>
          <h1 className="section-title">Periode Kinerja</h1>
          <p className="text-sm text-ink-500 mt-1">
            Kelola periode pencatatan kinerja harian per bulan dan bidang
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary"
            onClick={() => navigate('/admin/kinerja/buat')}
          >
            <Plus className="w-4 h-4" /> Buat Periode
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
          <input
            className="input pl-10"
            placeholder="Cari periode atau bidang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Year Filter */}
        <div className="w-full sm:w-48">
          <select
            className="input"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="">Semua Tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>Tahun {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : periodes.length === 0 ? (
        <div className="card text-center py-12">
          <CalendarDays className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <p className="text-ink-500">Belum ada periode kinerja.</p>
          {isAdmin && (
            <button
              className="btn-primary mt-4"
              onClick={() => navigate('/admin/kinerja/buat')}
            >
              <Plus className="w-4 h-4" /> Buat Periode Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {periodes.map((p) => (
            <div
              key={p.id}
              className="card-hover group cursor-pointer relative overflow-hidden"
              onClick={() => navigate(`/admin/kinerja/${p.id}`)}
            >
              {/* Status ribbon */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                p.status === 'aktif' ? 'bg-emerald-500' : 'bg-slate-400'
              }`} />

              <div className="flex items-start justify-between mb-3 pt-1">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    p.status === 'aktif'
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${
                      p.status === 'aktif' ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {p.status === 'aktif' ? '● Aktif' : '● Ditutup'}
                    </span>
                    <div className="text-xs text-ink-500">
                      {BULAN[p.bulan]} {p.tahun}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 transition-colors" />
              </div>

              <h3 className="font-semibold text-ink-900 text-sm leading-tight mb-1 line-clamp-2">
                {p.nama}
              </h3>
              <p className="text-xs text-ink-500 mb-3">{p.bidang}</p>

              <div className="flex items-center gap-4 text-xs text-ink-500 border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {p.jumlah_entri} entri
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {p.jumlah_pegawai} pegawai
                </span>
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100"
                     onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleStatus(p)}
                    className="btn text-xs !px-2 !py-1 text-ink-500 hover:bg-slate-100"
                    title={p.status === 'aktif' ? 'Tutup Periode' : 'Aktifkan Periode'}
                  >
                    {p.status === 'aktif'
                      ? <><Lock className="w-3.5 h-3.5" /> Tutup</>
                      : <><Unlock className="w-3.5 h-3.5" /> Aktifkan</>
                    }
                  </button>
                  <button
                    onClick={() => navigate(`/admin/kinerja/buat?edit=${p.id}`)}
                    className="btn text-xs !px-2 !py-1 text-ink-500 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.nama)}
                    className="btn text-xs !px-2 !py-1 text-accent-500 hover:bg-accent-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
