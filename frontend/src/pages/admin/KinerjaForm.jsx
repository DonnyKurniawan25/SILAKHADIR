import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
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
          google_form_url: data.google_form_url || '',
          gform_entry_nama: data.gform_entry_nama || '',
          gform_entry_nip: data.gform_entry_nip || '',
          gform_entry_uraian: data.gform_entry_uraian || '',
          gform_entry_link_bukti: data.gform_entry_link_bukti || '',
          gform_entry_tanggal: data.gform_entry_tanggal || '',
        })
      })
      .catch(() => {
        Swal.fire({ icon: 'error', title: 'Gagal memuat data periode' })
        navigate('/panel/kinerja')
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
      navigate('/panel/kinerja')
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
          onClick={() => navigate('/panel/kinerja')}
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

          {/* Google Forms Integration */}
          <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-800 text-sm">Integrasi Google Forms (Opsional)</span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Isi bagian ini agar setiap kinerja yang disubmit via aplikasi{' '}
              <strong>otomatis terkirim ke Google Form</strong> Anda.<br />
              Setiap hari Anda membuat Google Form baru, update URL dan Entry ID di sini.
            </p>

            {/* Cara mendapatkan Entry ID */}
            <details className="text-xs text-blue-700 bg-white rounded-lg p-3 border border-blue-100">
              <summary className="cursor-pointer font-semibold text-blue-800 mb-1">
                📖 Cara mendapatkan Entry ID (klik untuk buka)
              </summary>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>Buka Google Form Anda → klik ikon <strong>Pratinjau / Preview</strong> (mata)</li>
                <li>Di halaman pratinjau: klik kanan → <strong>View Page Source</strong></li>
                <li>Tekan <kbd className="bg-slate-100 px-1 rounded">Ctrl+F</kbd> → cari <code className="bg-slate-100 px-1 rounded">entry.</code></li>
                <li>Setiap field punya ID seperti <code className="bg-slate-100 px-1 rounded">entry.1234567890</code></li>
                <li>Salin angka-angkanya (dengan awalan <code>entry.</code>) ke kotak di bawah sesuai urutan field</li>
              </ol>
            </details>

            {/* URL Google Form */}
            <div>
              <label className="label text-blue-800">URL Google Form</label>
              <input
                id="google_form_url_input"
                className="input bg-white"
                type="url"
                placeholder="https://docs.google.com/forms/d/.../viewform"
                {...register('google_form_url', {
                  pattern: {
                    value: /^https:\/\/docs\.google\.com\/forms\/d\/.+/,
                    message: 'URL harus berupa link Google Forms yang valid',
                  },
                })}
              />
              {errors.google_form_url && (
                <p className="text-xs text-rose-700 mt-1">{errors.google_form_url.message}</p>
              )}
            </div>

            {/* Entry IDs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-blue-800">Entry ID — Nama</label>
                <input
                  id="gform_entry_nama_input"
                  className="input bg-white font-mono text-sm"
                  placeholder="entry.1234567890"
                  {...register('gform_entry_nama')}
                />
              </div>
              <div>
                <label className="label text-blue-800">Entry ID — NIP</label>
                <input
                  id="gform_entry_nip_input"
                  className="input bg-white font-mono text-sm"
                  placeholder="entry.9876543210"
                  {...register('gform_entry_nip')}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label text-blue-800">Entry ID — Uraian Kegiatan</label>
                <input
                  id="gform_entry_uraian_input"
                  className="input bg-white font-mono text-sm"
                  placeholder="entry.1122334455"
                  {...register('gform_entry_uraian')}
                />
              </div>
              <div>
                <label className="label text-blue-800">Entry ID — Link Bukti Dukung <span className="text-blue-400 font-normal">(opsional)</span></label>
                <input
                  id="gform_entry_link_bukti_input"
                  className="input bg-white font-mono text-sm"
                  placeholder="entry.5544332211"
                  {...register('gform_entry_link_bukti')}
                />
              </div>
              <div>
                <label className="label text-blue-800">Entry ID — Tanggal <span className="text-blue-400 font-normal">(opsional)</span></label>
                <input
                  id="gform_entry_tanggal_input"
                  className="input bg-white font-mono text-sm"
                  placeholder="entry.6677889900"
                  {...register('gform_entry_tanggal')}
                />
              </div>
            </div>
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
