import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Search, Users, FileText,
  CalendarDays, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getLaporan, exportLaporanUrl, getPeriode } from '../../api/kinerjaApi'

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export default function KinerjaLaporan() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [periode, setPeriode] = useState(null)
  const [laporan, setLaporan] = useState([])
  const [loading, setLoading] = useState(true)
  const [nipFilter, setNipFilter] = useState('')
  const [searchNip, setSearchNip] = useState('')
  const [expandedPegawai, setExpandedPegawai] = useState({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [periodeRes, laporanRes] = await Promise.all([
        getPeriode(id),
        getLaporan(id, searchNip ? { nip: searchNip } : {}),
      ])
      setPeriode(periodeRes.data)
      setLaporan(laporanRes.data.laporan || [])
    } catch { }
    setLoading(false)
  }, [id, searchNip])

  useEffect(() => { loadData() }, [loadData])

  const handleSearch = () => {
    setSearchNip(nipFilter)
  }

  const handleClearSearch = () => {
    setNipFilter('')
    setSearchNip('')
  }

  const toggleExpand = (pegawaiId) => {
    setExpandedPegawai((prev) => ({
      ...prev,
      [pegawaiId]: !prev[pegawaiId],
    }))
  }

  const handleExport = () => {
    const url = exportLaporanUrl(id, searchNip || null)
    const token = localStorage.getItem('silakhadir_access')
    // Open export with auth token
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `Laporan_Kinerja_${periode?.bidang || ''}.xlsx`
        link.click()
        URL.revokeObjectURL(link.href)
      })
      .catch(() => {
        alert('Gagal mengunduh laporan. Pastikan openpyxl terinstal di backend.')
      })
  }

  const totalKegiatan = laporan.reduce((sum, l) => sum + l.total_kegiatan, 0)

  if (!periode) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/panel/kinerja/${id}`)}
            className="btn text-ink-500 hover:text-ink-900 !px-0 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Detail
          </button>
          <div className="eyebrow">Laporan Kinerja</div>
          <h1 className="section-title">{periode.nama}</h1>
          <p className="text-sm text-ink-500 mt-1">
            {BULAN[periode.bulan]} {periode.tahun} — Bidang {periode.bidang}
          </p>
        </div>
        <button className="btn-primary" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* NIP Filter */}
      {isAdmin && (
        <div className="card">
          <div className="text-sm font-semibold text-ink-700 mb-2">
            Filter Laporan per Pegawai
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
              <input
                className="input pl-10"
                placeholder="Masukkan NIP pegawai..."
                value={nipFilter}
                onChange={(e) => setNipFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button className="btn-primary" onClick={handleSearch}>
              Cari
            </button>
            {searchNip && (
              <button className="btn-outline" onClick={handleClearSearch}>
                Reset
              </button>
            )}
          </div>
          {searchNip && (
            <div className="mt-2 text-sm text-brand-700">
              Menampilkan laporan untuk NIP: <strong>{searchNip}</strong>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-900">{laporan.length}</div>
            <div className="text-xs text-ink-500">Pegawai</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-900">{totalKegiatan}</div>
            <div className="text-xs text-ink-500">Total Kegiatan</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-50 text-accent-500 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-900">
              {BULAN[periode.bulan]?.substring(0, 3)}
            </div>
            <div className="text-xs text-ink-500">{periode.tahun}</div>
          </div>
        </div>
      </div>

      {/* Laporan per Pegawai */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : laporan.length === 0 ? (
        <div className="card text-center py-10">
          <FileText className="w-10 h-10 text-ink-300 mx-auto mb-2" />
          <p className="text-ink-500">
            {searchNip
              ? `Tidak ditemukan kinerja untuk NIP: ${searchNip}`
              : 'Belum ada kinerja yang tercatat di periode ini.'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary Table */}
          <div className="card !p-0 overflow-x-auto">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-ink-900 text-sm">Ringkasan per Pegawai</h3>
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NIP</th>
                  <th>Nama Pegawai</th>
                  <th>Jabatan</th>
                  <th className="text-center">Total Kegiatan</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {laporan.map((l, idx) => (
                  <tr key={l.nip_pegawai}>
                    <td className="text-center text-ink-500">{idx + 1}</td>
                    <td className="whitespace-nowrap font-mono text-sm">
                      {l.nip_pegawai || '-'}
                    </td>
                    <td className="font-semibold text-ink-900">{l.nama_pegawai}</td>
                    <td className="text-sm text-ink-500">
                      {l.entries?.[0]?.jabatan_pegawai || l.entries?.[0]?.pegawai_detail?.jabatan || '-'}
                    </td>
                    <td className="text-center font-semibold">{l.total_kegiatan}</td>
                    <td>
                      <button
                        className="btn text-xs !px-2 !py-1 bg-brand-50 text-brand-700 hover:bg-brand-100"
                        onClick={() => navigate(`/panel/kinerja/${id}/laporan/${l.nip_pegawai}`)}
                      >
                        Detail Laporan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
