import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Image as ImageIcon, Upload } from 'lucide-react'
import Swal from 'sweetalert2'
import { fetchAppSetting, updateAppSetting } from '../../api/authApi'
import { useBranding } from '../../context/BrandingContext'

export default function Settings() {
  const { refresh } = useBranding()
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm()
  const [logoUrl, setLogoUrl] = useState(null)

  const watchLogo = watch('institution_logo')
  const logoPreview =
    watchLogo && typeof FileList !== 'undefined' && watchLogo instanceof FileList && watchLogo.length > 0
      ? URL.createObjectURL(watchLogo[0])
      : null

  useEffect(() => {
    fetchAppSetting().then((r) => {
      // Jangan masukkan field file (institution_logo, signature_image, stamp_image)
      // ke reset() karena nilainya dari API berupa URL string, bukan FileList.
      const { institution_logo, signature_image, stamp_image, ...rest } = r.data
      reset(rest)
      setLogoUrl(r.data.logo_url)
    })
  }, [reset])

  const onSubmit = async (values) => {
    try {
      const fd = new FormData()
      Object.entries(values).forEach(([k, v]) => {
        if (v instanceof FileList) {
          if (v.length) fd.append(k, v[0])
        } else if (v !== null && v !== undefined && typeof v !== 'object') {
          fd.append(k, v)
        }
      })
      await updateAppSetting(fd)
      const { data } = await fetchAppSetting()
      setLogoUrl(data.logo_url)
      reset(data)
      await refresh()
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1400, showConfirmButton: false })
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: JSON.stringify(e?.response?.data || {}) })
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="section-title">Pengaturan Aplikasi</h1>
        <p className="text-slate-500 text-sm">
          Atur identitas instansi. Logo akan dipakai sebagai favicon dan pada QR absensi.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 max-w-3xl">
        {/* Logo uploader */}
        <div>
          <label className="label">Logo Website / Instansi</label>
          <p className="text-xs text-slate-500 mb-3">
            Rekomendasi: PNG transparan persegi (512×512 atau lebih besar). Logo dipakai
            sebagai favicon, header, dan di tengah QR code absensi.
          </p>
          <div className="flex items-center gap-5">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
              {(logoPreview || logoUrl) ? (
                <img src={logoPreview || logoUrl} alt="logo"
                     className="w-full h-full object-contain p-2" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="btn-outline cursor-pointer">
                <Upload className="w-4 h-4" /> Pilih Logo Baru
                <input type="file" accept="image/png,image/jpeg,image/svg+xml"
                       className="hidden" {...register('institution_logo')} />
              </label>
              {logoPreview && (
                <p className="text-xs text-emerald-600 mt-2">
                  Logo baru siap disimpan. Klik "Simpan Pengaturan" di bawah.
                </p>
              )}
            </div>
          </div>
        </div>

        <hr />

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Nama Aplikasi</label>
            <input className="input" {...register('app_name')} />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input className="input" {...register('tagline')} />
          </div>
        </div>
        <div>
          <label className="label">Nama Instansi</label>
          <input className="input" {...register('institution_name')} />
        </div>
        <div>
          <label className="label">Alamat</label>
          <input className="input" {...register('address')} />
        </div>

        <hr />

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Nama Kepala Instansi</label>
            <input className="input" {...register('head_name')} />
          </div>
          <div>
            <label className="label">Jabatan</label>
            <input className="input" {...register('head_position')} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Tanda Tangan Pejabat</label>
            <input type="file" accept="image/*" className="input !py-1.5" {...register('signature_image')} />
          </div>
          <div>
            <label className="label">Stempel Digital</label>
            <input type="file" accept="image/*" className="input !py-1.5" {...register('stamp_image')} />
          </div>
        </div>

        <hr />

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Warna Utama</label>
            <input className="input" {...register('primary_color')} placeholder="#0b2d6b" />
          </div>
          <div>
            <label className="label">Warna Aksen</label>
            <input className="input" {...register('secondary_color')} placeholder="#d1a827" />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  )
}
