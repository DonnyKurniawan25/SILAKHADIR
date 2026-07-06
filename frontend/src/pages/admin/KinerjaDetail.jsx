import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft, Plus, Pencil, Trash2, CalendarDays,
  FileText, Users, BarChart3, ClipboardList,
} from 'lucide-react'
import Swal from 'sweetalert2'
import { useAuth } from '../../context/AuthContext'
import {
  getPeriode, listKinerja,
  createKinerja, updateKinerja, deleteKinerja,
} from '../../api/kinerjaApi'

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export default function KinerjaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [periode, setPeriode] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('saya') // saya | semua
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)

  const loadPeriode = useCallback(async () => {
    try {
      const { data } = await getPeriode(id)
      setPeriode(data)
    } catch {
      Swal.fire({ icon: 'error', title: 'Periode tidak ditemukan' })
      navigate('/panel/kinerja')
    }
  }, [id, navigate])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = { periode: id, page_size: 200 }
      const { data } = await listKinerja(params)
      setEntries(data.results || data)
    } catch { }
    setLoading(false)
  }, [id])

  useEffect(() => { loadPeriode(); loadEntries() }, [loadPeriode, loadEntries])

  useEffect(() => {
    if (user) {
      setTab(user.role === 'admin' || user.role === 'superadmin' ? 'semua' : 'saya')
    }
  }, [user])

  const myEntries = entries.filter((e) => e.pegawai === user?.id || (user?.nip && e.nip_pegawai === user?.nip))
  const displayEntries = tab === 'saya' ? myEntries : entries

  const handleDelete = async (entryId) => {
    const r = await Swal.fire({
      title: 'Hapus Kinerja?',
      text: 'Data kinerja ini akan dihapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d32f2f',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    })
    if (!r.isConfirmed) return
    try {
      await deleteKinerja(entryId)
      Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1200, showConfirmButton: false })
      loadEntries()
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal menghapus' })
    }
  }

  const handleEdit = (entry) => {
    setEditEntry(entry)
    setShowForm(true)
  }

  const handleFormSaved = () => {
    setShowForm(false)
    setEditEntry(null)
    loadEntries()
    loadPeriode()
  }

  if (!periode) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const isActive = periode.status === 'aktif'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/panel/kinerja')}
          className="btn text-ink-500 hover:text-ink-900 !px-0 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="eyebrow">Kinerja ASN</div>
        <h1 className="section-title">{periode.nama}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className={`badge ${isActive ? 'badge-green' : 'badge-gray'}`}>
            {isActive ? 'Aktif' : 'Ditutup'}
          </span>
          <span className="text-sm text-ink-500">
            {BULAN[periode.bulan]} {periode.tahun} — {periode.bidang}
          </span>
        </div>
        {isActive && (
          <div className="mt-3 p-3 bg-brand-50 border border-brand-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-brand-900">
              <strong>Tautan Form Pengisian Pegawai:</strong>{' '}
              <a href={periode.form_url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                {periode.form_url}
              </a>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(periode.form_url)
                Swal.fire({ icon: 'success', title: 'Tautan disalin!', timer: 1000, showConfirmButton: false })
              }}
              className="btn text-xs !py-1 !px-2 bg-brand-600 text-white hover:bg-brand-700 whitespace-nowrap self-start sm:self-auto"
            >
              Salin Tautan
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {isAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-ink-900">{periode.jumlah_entri}</div>
              <div className="text-xs text-ink-500">Total Entri</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-ink-900">{periode.jumlah_pegawai}</div>
              <div className="text-xs text-ink-500">Pegawai</div>
            </div>
          </div>
          <div className="card flex items-center gap-3 cursor-pointer hover:shadow-card-hover transition-shadow"
               onClick={() => navigate(`/panel/kinerja/${id}/laporan`)}>
            <div className="w-10 h-10 rounded-lg bg-accent-50 text-accent-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-brand-700">Lihat Laporan →</div>
              <div className="text-xs text-ink-500">Rekap & Export</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-100 text-gold-700 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-ink-900">{myEntries.length}</div>
              <div className="text-xs text-ink-500">Kinerja Saya</div>
            </div>
          </div>
          <div className="card flex items-center gap-3 cursor-pointer hover:shadow-card-hover transition-shadow"
               onClick={() => navigate(`/panel/kinerja/${id}/laporan/${user?.nip}`)}>
            <div className="w-10 h-10 rounded-lg bg-accent-50 text-accent-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-brand-700">Lihat Laporan →</div>
              <div className="text-xs text-ink-500">Cetak Laporan Saya</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {isAdmin ? (
          <div>
            <h3 className="font-serif font-bold text-ink-900 text-lg">Daftar Kinerja Pegawai</h3>
          </div>
        ) : (
          <div className="flex border-b border-slate-200">
            <button
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                tab === 'saya'
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
              onClick={() => setTab('saya')}
            >
              Kinerja Saya ({myEntries.length})
            </button>
          </div>
        )}
        {isActive && (
          <button
            className="btn-primary"
            onClick={() => { setEditEntry(null); setShowForm(true) }}
          >
            <Plus className="w-4 h-4" /> Tambah Kinerja
          </button>
        )}
      </div>

      {/* Entry Form Modal */}
      {showForm && (
        <KinerjaEntryForm
          periodeId={id}
          entry={editEntry}
          user={user}
          onSaved={handleFormSaved}
          onClose={() => { setShowForm(false); setEditEntry(null) }}
        />
      )}

      {/* Entries Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : displayEntries.length === 0 ? (
        <div className="card text-center py-10">
          <CalendarDays className="w-10 h-10 text-ink-300 mx-auto mb-2" />
          <p className="text-ink-500">
            {tab === 'saya'
              ? 'Anda belum mencatat kinerja di periode ini.'
              : 'Belum ada kinerja yang tercatat di periode ini.'}
          </p>
          {isActive && tab === 'saya' && (
            <button
              className="btn-primary mt-3"
              onClick={() => { setEditEntry(null); setShowForm(true) }}
            >
              <Plus className="w-4 h-4" /> Mulai Catat Kinerja
            </button>
          )}
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                {tab === 'semua' && <th>Pegawai</th>}
                <th>Uraian Kegiatan</th>
                <th>Bukti</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((e, idx) => {
                const canEdit = e.pegawai === user?.id || (user?.nip && e.nip_pegawai === user?.nip) || isAdmin
                return (
                  <tr key={e.id}>
                    <td className="text-center text-ink-500">{idx + 1}</td>
                    <td className="whitespace-nowrap">
                      {new Date(e.tanggal).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    {tab === 'semua' && (
                      <td>
                        <div className="font-semibold text-ink-900 text-xs">
                          {e.nama_pegawai}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          NIP: {e.nip_pegawai || '-'}
                        </div>
                      </td>
                    )}
                    <td className="max-w-xs">
                      <div className="text-sm line-clamp-2">{e.uraian_kegiatan}</div>
                      {e.keterangan && (
                        <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-1">
                          Ket: {e.keterangan}
                        </div>
                      )}
                    </td>
                    <td>
                      {e.link_bukti ? (
                        <a
                          href={e.link_bukti}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline font-semibold text-xs"
                        >
                          Lihat Bukti
                        </a>
                      ) : (
                        <span className="text-ink-300 text-xs">-</span>
                      )}
                    </td>
                    <td>
                      {canEdit && isActive && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(e)}
                            className="p-1.5 rounded hover:bg-slate-100 text-ink-500"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="p-1.5 rounded hover:bg-accent-50 text-accent-500"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


/**
 * Inline modal form for creating/editing kinerja harian entries
 */
function KinerjaEntryForm({ periodeId, entry, user, onSaved, onClose }) {
  const {
    register, handleSubmit, reset,
    formState: { isSubmitting, errors },
  } = useForm()

  useEffect(() => {
    if (entry) {
      reset({
        tanggal: entry.tanggal,
        uraian_kegiatan: entry.uraian_kegiatan,
        jabatan_pegawai: entry.jabatan_pegawai || '',
        link_bukti: entry.link_bukti || '',
        keterangan: entry.keterangan || '',
      })
    } else {
      reset({
        tanggal: new Date().toISOString().split('T')[0],
        jabatan_pegawai: user?.jabatan || '',
        link_bukti: '',
      })
    }
  }, [entry, reset, user])

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        periode: periodeId,
        volume: 1,
        satuan: 'Kegiatan',
        nama_pegawai: entry ? entry.nama_pegawai : (user?.first_name || user?.username || ''),
        nip_pegawai: entry ? entry.nip_pegawai : (user?.nip || ''),
        email_pegawai: entry ? entry.email_pegawai : (user?.email || ''),
        no_hp_pegawai: entry ? entry.no_hp_pegawai : (user?.phone || ''),
      }
      if (entry) {
        await updateKinerja(entry.id, payload)
      } else {
        await createKinerja(payload)
      }
      Swal.fire({
        icon: 'success',
        title: entry ? 'Kinerja Diperbarui' : 'Kinerja Ditambahkan',
        timer: 1200, showConfirmButton: false,
      })
      onSaved()
    } catch (e) {
      const msg = e?.response?.data
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: typeof msg === 'string' ? msg : JSON.stringify(msg),
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
         onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-ink-900">
            {entry ? 'Edit Kinerja Harian' : 'Tambah Kinerja Harian'}
          </h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-lg font-bold">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Tanggal */}
          <div>
            <label className="label">Tanggal Kegiatan *</label>
            <input
              type="date"
              className="input"
              {...register('tanggal', { required: 'Tanggal wajib diisi' })}
            />
            {errors.tanggal && (
              <p className="text-xs text-rose-700 mt-1">{errors.tanggal.message}</p>
            )}
          </div>

          {/* Jabatan Pegawai */}
          <div>
            <label className="label">Jabatan ASN *</label>
            <input
              className="input"
              placeholder="e.g. Pranata Komputer, Analis Kebijakan..."
              {...register('jabatan_pegawai', { required: 'Jabatan wajib diisi' })}
            />
            {errors.jabatan_pegawai && (
              <p className="text-xs text-rose-700 mt-1">{errors.jabatan_pegawai.message}</p>
            )}
          </div>

          {/* Uraian Kegiatan */}
          <div>
            <label className="label">Uraian Kegiatan *</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Jelaskan kegiatan yang dilakukan..."
              {...register('uraian_kegiatan', { required: 'Uraian kegiatan wajib diisi' })}
            />
            {errors.uraian_kegiatan && (
              <p className="text-xs text-rose-700 mt-1">{errors.uraian_kegiatan.message}</p>
            )}
          </div>

          {/* Link Bukti */}
          <div>
            <label className="label">Link Bukti Dukung (opsional)</label>
            <input
              type="url"
              className="input"
              placeholder="e.g. https://drive.google.com/..."
              {...register('link_bukti')}
            />
          </div>

          {/* Keterangan */}
          <div>
            <label className="label">Keterangan (opsional)</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Catatan tambahan..."
              {...register('keterangan')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="btn-outline flex-1">
              Batal
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Menyimpan...' : entry ? 'Perbarui' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
