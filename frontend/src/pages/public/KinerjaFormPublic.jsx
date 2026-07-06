import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { publicPeriodeInfo, submitPublicKinerja, lookupPegawaiByNip } from '../../api/kinerjaApi'
import { Calendar, User, FileText, Loader2, AlertCircle, Award, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import Swal from 'sweetalert2'
import Captcha from '../../components/Captcha'

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export default function KinerjaFormPublic() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const captchaRef = useRef(null)
  const [periode, setPeriode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm({
    defaultValues: {
      tanggal: new Date().toISOString().split('T')[0],
      email_pegawai: '',
      no_hp_pegawai: '',
      jabatan_pegawai: '',
      link_bukti: '',
      keterangan: '',
    },
  })

  const handleNipChange = async (val) => {
    if (val.length === 18 && /^[0-9]+$/.test(val)) {
      try {
        const { data } = await lookupPegawaiByNip(val)
        if (data.nama_pegawai) {
          setValue('nama_pegawai', data.nama_pegawai)
        }
        if (data.email_pegawai) {
          setValue('email_pegawai', data.email_pegawai)
        }
        if (data.no_hp_pegawai) {
          setValue('no_hp_pegawai', data.no_hp_pegawai)
        }
        if (data.jabatan_pegawai) {
          setValue('jabatan_pegawai', data.jabatan_pegawai)
        }
      } catch (err) {
        // Silently fail
      }
    }
  }

  useEffect(() => {
    publicPeriodeInfo(slug)
      .then((r) => setPeriode(r.data))
      .catch(() => setPeriode(null))
      .finally(() => setLoading(false))
  }, [slug])

  const onSubmit = async (data) => {
    const captcha = captchaRef.current?.getValue()
    if (!captcha?.token || !captcha?.answer) {
      Swal.fire({
        icon: 'warning',
        title: 'Verifikasi CAPTCHA',
        text: 'Silakan isi verifikasi matematika terlebih dahulu.',
      })
      return
    }

    try {
      const { data: res } = await submitPublicKinerja(slug, {
        ...data,
        captcha_token: captcha.token,
        captcha_answer: captcha.answer,
      })
      setSubmittedData({
        nama: data.nama_pegawai,
        kegiatan: data.uraian_kegiatan,
        periode: periode?.nama,
      })
      setSuccess(true)
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Dicatat!',
        text: 'Kinerja harian Anda telah berhasil terekam.',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (e) {
      captchaRef.current?.refresh()
      const resp = e?.response?.data || {}
      const msg = resp.captcha?.[0] || resp.detail || Object.values(resp)?.[0]?.[0] || 'Gagal mencatat kinerja harian.'
      Swal.fire({ icon: 'error', title: 'Gagal Kirim', text: String(msg) })
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-700" />
      </div>
    )
  }

  if (!periode) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="border border-rose-200 bg-rose-50 rounded p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-700 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Periode Kinerja Tidak Ditemukan</div>
            <p className="text-sm text-rose-800 mt-1">
              Tautan form pengisian kinerja ini tidak valid atau telah kedaluwarsa. Silakan hubungi admin bidang Anda.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isClosed = periode.status !== 'aktif'

  if (success && submittedData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-card">
          <div className="p-6 border-b border-slate-200 flex items-center gap-3 bg-emerald-50">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="eyebrow text-emerald-700 font-bold">Sukses</div>
              <h1 className="font-serif font-bold text-xl text-ink-900">Kinerja Harian Tercatat</h1>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-ink-700">
              Terima kasih, <span className="font-bold text-brand-850">{submittedData.nama}</span>. Laporan kinerja harian Anda untuk periode <span className="font-semibold text-ink-900">"{submittedData.periode}"</span> telah berhasil terekam.
            </p>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded text-sm text-ink-700">
              <strong>Kegiatan:</strong> {submittedData.kegiatan}
            </div>
            <p className="text-sm text-ink-500">
              Anda dapat mengisi kembali kinerja untuk kegiatan lainnya atau menutup halaman ini.
            </p>
          </div>
          <div className="bg-slate-50 border-t border-slate-200 p-6 flex justify-end gap-2">
            <button
              onClick={() => {
                setSuccess(false)
                reset({
                  tanggal: new Date().toISOString().split('T')[0],
                  email_pegawai: '',
                  no_hp_pegawai: '',
                  jabatan_pegawai: '',
                  link_bukti: '',
                  keterangan: '',
                })
              }}
              className="btn-primary"
            >
              Isi Kegiatan Lainnya
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header Info */}
      <div className="border border-slate-200 rounded bg-white mb-5 overflow-hidden shadow-card">
        <div className="p-5 border-b border-slate-200">
          <div className="eyebrow">Formulir Kinerja Harian ASN</div>
          <h1 className="font-serif font-bold text-2xl text-ink-900 mt-1">{periode.nama}</h1>
          <p className="text-ink-500 text-sm mt-1">Bidang: {periode.bidang}</p>
          <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-ink-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Periode: {BULAN[periode.bulan]} {periode.tahun}
            </div>
          </div>
        </div>
        <div className="gov-divider" />
      </div>

      {isClosed && (
        <div className="border border-amber-200 bg-amber-50 rounded p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">Penerimaan Kinerja Ditutup</div>
            <p className="text-sm text-amber-800">
              Periode pencatatan ini sudah ditutup. Anda tidak dapat mengirimkan kinerja baru untuk periode ini.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 shadow-card">
        {/* Identitas Pegawai */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1"><User className="w-4 h-4" /> A. Identitas Pegawai</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nama Lengkap *</label>
              <input
                className="input"
                placeholder="Nama lengkap beserta gelar..."
                {...register('nama_pegawai', { required: 'Nama lengkap wajib diisi' })}
              />
              {errors.nama_pegawai && <p className="text-xs text-rose-600 mt-1">{errors.nama_pegawai.message}</p>}
            </div>
            <div>
              <label className="label">NIP ASN *</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength={18}
                placeholder="18 digit NIP..."
                {...register('nip_pegawai', {
                  required: 'NIP wajib diisi',
                  pattern: { value: /^[0-9]+$/, message: 'NIP hanya boleh berisi angka' },
                  minLength: { value: 18, message: 'NIP harus 18 digit' },
                  maxLength: { value: 18, message: 'NIP harus 18 digit' },
                  onChange: (e) => handleNipChange(e.target.value),
                })}
              />
              {errors.nip_pegawai && <p className="text-xs text-rose-600 mt-1">{errors.nip_pegawai.message}</p>}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Surel / Email (opsional)</label>
              <input
                type="email"
                className="input"
                placeholder="nama@domain.com..."
                {...register('email_pegawai')}
              />
            </div>
            <div>
              <label className="label">Nomor HP / WA (opsional)</label>
              <input
                type="tel"
                className="input"
                placeholder="e.g. 08123456789..."
                {...register('no_hp_pegawai')}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Jabatan ASN *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Pranata Komputer Ahli Pertama, Pengadministrasi Umum..."
              {...register('jabatan_pegawai', { required: 'Jabatan wajib diisi' })}
            />
            {errors.jabatan_pegawai && <p className="text-xs text-rose-600 mt-1">{errors.jabatan_pegawai.message}</p>}
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* Detail Laporan Kinerja */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1"><FileText className="w-4 h-4" /> B. Detail Kinerja Harian</div>
          <div className="space-y-4">
            <div>
              <label className="label">Tanggal Kegiatan *</label>
              <input
                type="date"
                className="input animate-fade-in"
                {...register('tanggal', { required: 'Tanggal wajib diisi' })}
              />
              {errors.tanggal && <p className="text-xs text-rose-600 mt-1">{errors.tanggal.message}</p>}
            </div>

            <div>
              <label className="label">Uraian Kegiatan *</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Tuliskan detail pekerjaan/kegiatan yang Anda selesaikan..."
                {...register('uraian_kegiatan', { required: 'Uraian kegiatan wajib diisi' })}
              />
              {errors.uraian_kegiatan && <p className="text-xs text-rose-600 mt-1">{errors.uraian_kegiatan.message}</p>}
            </div>

            <div>
              <label className="label flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5" /> Link Bukti Dukung (opsional)</label>
              <input
                type="url"
                className="input"
                placeholder="e.g. https://drive.google.com/... (bisa dikosongkan)"
                {...register('link_bukti')}
              />
              {errors.link_bukti && <p className="text-xs text-rose-600 mt-1">{errors.link_bukti.message}</p>}
            </div>

            <div>
              <label className="label">Keterangan (opsional)</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Catatan tambahan lainnya..."
                {...register('keterangan')}
              />
            </div>
          </div>
        </div>

        <div className="my-4 bg-slate-50 p-4 border border-slate-200 rounded">
          <Captcha ref={captchaRef} />
        </div>

        <div className="pt-3 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSubmitting || isClosed}
            className="btn-primary w-full text-base py-3"
          >
            {isSubmitting ? 'Mengirim Data...' : 'Kirim Kinerja Harian'}
          </button>
          <p className="text-[11px] text-ink-500 mt-2 text-center">
            Pernyataan: Dengan mengirim formulir ini, data kinerja harian Anda akan tercatat secara resmi.
          </p>
        </div>
      </form>
    </div>
  )
}
