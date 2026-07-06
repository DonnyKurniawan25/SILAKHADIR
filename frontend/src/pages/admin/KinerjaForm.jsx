import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Swal from 'sweetalert2'
import { createPeriode, getPeriode, updatePeriode } from '../../api/kinerjaApi'

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
]

export default function KinerjaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [loadingData, setLoadingData] = useState(!!editId)

  const {
    register, handleSubmit, reset,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      bulan: new Date().getMonth() + 1,
      tahun: new Date().getFullYear(),
      status: 'aktif',
    },
  })

  useEffect(() => {
    if (!editId) return
    setLoadingData(true)
    getPeriode(editId)
      .then(({ data }) => {
        reset({
          nama: data.nama,
          bulan: data.bulan,
          tahun: data.tahun,
          bidang: data.bidang,
          deskripsi: data.deskripsi,
          status: data.status,
          kepala_bidang_nama: data.kepala_bidang_nama || '',
          kepala_bidang_nip: data.kepala_bidang_nip || '',
        })
      })
      .catch(() => {
        Swal.fire({ icon: 'error', title: 'Gagal memuat data periode' })
        navigate('/admin/kinerja')
      })
      .finally(() => setLoadingData(false))
  }, [editId, reset, navigate])

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        bulan: parseInt(data.bulan),
        tahun: parseInt(data.tahun),
      }
      if (editId) {
        await updatePeriode(editId, payload)
      } else {
        await createPeriode(payload)
      }
      Swal.fire({
        icon: 'success',
        title: editId ? 'Periode Diperbarui' : 'Periode Dibuat',
        timer: 1400,
        showConfirmButton: false,
      })
      navigate('/admin/kinerja')
    } catch (e) {
      const msg = e?.response?.data
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: typeof msg === 'object' ? JSON.stringify(msg) : msg || 'Terjadi kesalahan',
      })
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/admin/kinerja')}
          className="btn text-ink-500 hover:text-ink-900 !px-0 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="eyebrow">Kinerja ASN</div>
        <h1 className="section-title">
          {editId ? 'Edit Periode Kinerja' : 'Buat Periode Kinerja Baru'}
        </h1>
      </div>

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nama Periode */}
          <div>
            <label className="label">Nama Periode *</label>
            <input
              className="input"
              placeholder='e.g. "Juli 2026 - Bidang Pemerintahan Digital"'
              {...register('nama', { required: 'Nama periode wajib diisi' })}
            />
            {errors.nama && (
              <p className="text-xs text-rose-700 mt-1">{errors.nama.message}</p>
            )}
          </div>

          {/* Bulan & Tahun */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bulan *</label>
              <select
                className="input"
                {...register('bulan', { required: true })}
              >
                {BULAN_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tahun *</label>
              <input
                type="number"
                className="input"
                min={2020}
                max={2099}
                {...register('tahun', { required: true })}
              />
            </div>
          </div>

          {/* Bidang */}
          <div>
            <label className="label">Bidang *</label>
            <input
              className="input"
              placeholder='e.g. "Pemerintahan Digital"'
              {...register('bidang', { required: 'Bidang wajib diisi' })}
            />
            {errors.bidang && (
              <p className="text-xs text-rose-700 mt-1">{errors.bidang.message}</p>
            )}
          </div>

          {/* Deskripsi */}
          <div>
            <label className="label">Deskripsi (opsional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Catatan atau deskripsi untuk periode ini..."
              {...register('deskripsi')}
            />
          </div>
          {/* Kepala Bidang */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nama Kepala Bidang (Atasan)</label>
              <input
                className="input"
                placeholder='e.g. "Nama Atasan, M.Kom"'
                {...register('kepala_bidang_nama')}
              />
            </div>
            <div>
              <label className="label">NIP Kepala Bidang</label>
              <input
                className="input"
                placeholder='e.g. "19801231..."'
                {...register('kepala_bidang_nip')}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select className="input" {...register('status')}>
              <option value="aktif">Aktif</option>
              <option value="ditutup">Ditutup</option>
            </select>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-200">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? 'Menyimpan...' : editId ? 'Perbarui Periode' : 'Buat Periode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
