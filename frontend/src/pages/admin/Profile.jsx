import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Key, Lock, Mail, Phone, Building, BadgeInfo, Loader2 } from 'lucide-react'
import Swal from 'sweetalert2'
import { useAuth } from '../../context/AuthContext'
import { updateUser, changeUserPassword } from '../../api/userApi'
import { fetchMe } from '../../api/authApi'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      first_name: '',
      email: '',
      nip: '',
      jabatan: '',
      phone: '',
      institution: '',
    }
  })

  const { register: registerPass, handleSubmit: handleSubmitPass, reset: resetPass, formState: { errors: errorsPass } } = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    }
  })

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name || '',
        email: user.email || '',
        nip: user.nip || '',
        jabatan: user.jabatan || '',
        phone: user.phone || '',
        institution: user.institution || '',
      })
    }
  }, [user, reset])

  const onUpdateProfile = async (data) => {
    if (!user) return
    setSavingProfile(true)
    try {
      // Put/patch call
      await updateUser(user.id, {
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        ...data,
      })
      // Fetch me and refresh context
      const fresh = await fetchMe()
      setUser(fresh.data)
      Swal.fire({ icon: 'success', title: 'Profil Diperbarui', text: 'Perubahan profil berhasil disimpan.', timer: 1500, showConfirmButton: false })
    } catch (e) {
      const resp = e?.response?.data || {}
      const msg = resp.detail || Object.values(resp)?.[0]?.[0] || 'Gagal menyimpan profil.'
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: String(msg) })
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async (data) => {
    if (!user) return
    if (data.password !== data.confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Kata sandi tidak cocok', text: 'Konfirmasi kata sandi baru harus sesuai.' })
      return
    }
    setSavingPassword(true)
    try {
      await changeUserPassword(user.id, data.password)
      resetPass()
      Swal.fire({ icon: 'success', title: 'Kata Sandi Diperbarui', text: 'Kata sandi Anda berhasil diperbarui.', timer: 1500, showConfirmButton: false })
    } catch (e) {
      const resp = e?.response?.data || {}
      const msg = resp.detail || 'Gagal memperbarui kata sandi.'
      Swal.fire({ icon: 'error', title: 'Gagal Memperbarui', text: String(msg) })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <div className="eyebrow">Pengaturan Akun</div>
        <h1 className="section-title mt-1">Profil Pengguna</h1>
        <p className="text-sm text-ink-500 mt-1">
          Kelola informasi profil pribadi Anda dan perbarui kata sandi.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Form Profil */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="font-serif font-bold text-lg text-ink-900 flex items-center gap-1.5 mt-0.5">
              <User className="w-5 h-5 text-brand-700" /> Informasi Pribadi
            </h2>
          </div>

          <form onSubmit={handleSubmit(onUpdateProfile)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Nama Lengkap */}
              <div>
                <label className="label">Nama Lengkap *</label>
                <input
                  className="input"
                  placeholder="Nama beserta gelar..."
                  {...register('first_name', { required: 'Nama lengkap wajib diisi' })}
                />
                {errors.first_name && <p className="text-xs text-rose-600 mt-1">{errors.first_name.message}</p>}
              </div>

              {/* Username (Read Only) */}
              <div>
                <label className="label">Username (Tidak dapat diubah)</label>
                <input
                  className="input bg-slate-50 cursor-not-allowed"
                  disabled
                  value={user?.username || ''}
                />
              </div>

              {/* NIP */}
              <div>
                <label className="label">NIP ASN</label>
                <input
                  className="input"
                  placeholder="18 digit NIP..."
                  {...register('nip')}
                />
              </div>

              {/* Jabatan */}
              <div>
                <label className="label">Jabatan ASN</label>
                <input
                  className="input"
                  placeholder="Pranata Komputer, Pengadministrasi..."
                  {...register('jabatan')}
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">Surel / Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="nama@domain.com..."
                    {...register('email')}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="label">Nomor HP</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    className="input pl-10"
                    placeholder="e.g. 08123456789..."
                    {...register('phone')}
                  />
                </div>
              </div>

              {/* Instansi */}
              <div className="md:col-span-2">
                <label className="label">Instansi / Unit Kerja</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    className="input pl-10"
                    placeholder="Nama dinas / instansi..."
                    {...register('institution')}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button type="submit" disabled={savingProfile} className="btn-primary min-w-[120px]">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Simpan Profil'}
              </button>
            </div>
          </form>
        </div>

        {/* Kolom Kanan: Form Password */}
        <div className="card space-y-4 h-fit">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="font-serif font-bold text-lg text-ink-900 flex items-center gap-1.5 mt-0.5">
              <Lock className="w-5 h-5 text-brand-700" /> Perbarui Kata Sandi
            </h2>
          </div>

          <form onSubmit={handleSubmitPass(onChangePassword)} className="space-y-4">
            <div>
              <label className="label">Kata Sandi Baru *</label>
              <input
                type="password"
                className="input"
                placeholder="Minimal 6 karakter..."
                {...registerPass('password', {
                  required: 'Kata sandi baru wajib diisi',
                  minLength: { value: 6, message: 'Minimal 6 karakter' }
                })}
              />
              {errorsPass.password && <p className="text-xs text-rose-600 mt-1">{errorsPass.password.message}</p>}
            </div>

            <div>
              <label className="label">Konfirmasi Kata Sandi Baru *</label>
              <input
                type="password"
                className="input"
                placeholder="Ulangi kata sandi baru..."
                {...registerPass('confirmPassword', {
                  required: 'Konfirmasi kata sandi wajib diisi'
                })}
              />
              {errorsPass.confirmPassword && <p className="text-xs text-rose-600 mt-1">{errorsPass.confirmPassword.message}</p>}
            </div>

            <div className="pt-3 border-t border-slate-100 flex">
              <button type="submit" disabled={savingPassword} className="btn-primary w-full">
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Perbarui Sandi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
