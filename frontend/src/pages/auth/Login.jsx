import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBranding } from '../../context/BrandingContext'
import Captcha from '../../components/Captcha'
import Swal from 'sweetalert2'

export default function Login() {
  const { login } = useAuth()
  const { setting } = useBranding()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()
  const [error, setError] = useState('')
  const captchaRef = useRef(null)

  const onSubmit = async (data) => {
    setError('')
    const captcha = captchaRef.current?.getValue()
    if (!captcha?.token || !captcha?.answer) {
      setError('Mohon isi verifikasi keamanan.')
      return
    }
    try {
      await login(data.username, data.password, {
        captchaToken: captcha.token,
        captchaAnswer: captcha.answer,
      })
      navigate('/admin')
    } catch (e) {
      const resp = e?.response?.data || {}
      const msg = resp.captcha?.[0]
        || resp.detail
        || 'Nama pengguna atau kata sandi tidak sesuai.'
      setError(String(msg))
      captchaRef.current?.refresh()
      Swal.fire({ icon: 'error', title: 'Masuk Gagal', text: String(msg) })
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          {setting?.logo_url ? (
            <img src={setting.logo_url} alt="logo" className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded bg-brand-800 text-white font-extrabold flex items-center justify-center">S</div>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-500">
              Sistem Informasi Resmi
            </div>
            <div className="font-bold text-ink-900 leading-tight">
              {setting?.app_name || 'SILAKHADIR'}
            </div>
          </div>
        </div>
        <div className="gov-divider" />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="border border-slate-200 rounded bg-white overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h1 className="font-bold text-2xl text-ink-900">Masuk Sistem</h1>
              <p className="text-sm text-ink-500 mt-1">
                Halaman ini diperuntukkan bagi Administrator dan Operator kegiatan.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {error && (
                <div className="border border-rose-200 bg-rose-50 rounded p-3 flex items-start gap-2 text-sm text-rose-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="label">Nama Pengguna</label>
                <input className="input" {...register('username', { required: true })} autoFocus />
              </div>
              <div>
                <label className="label">Kata Sandi</label>
                <input type="password" className="input" {...register('password', { required: true })} />
              </div>

              <Captcha ref={captchaRef} />

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                <LogIn className="w-4 h-4" />
                {isSubmitting ? 'Memproses...' : 'Masuk'}
              </button>

              <div className="text-center pt-1">
                <Link to="/" className="text-sm text-brand-700 hover:underline">
                  Kembali ke Beranda
                </Link>
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-ink-500 mt-4">
            © {new Date().getFullYear()} {setting?.institution_name || 'Pemerintah Daerah'}
          </p>
        </div>
      </main>
    </div>
  )
}
