import { useEffect, useImperativeHandle, forwardRef, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import api from '../api/axios'

/**
 * Komponen CAPTCHA berbasis soal matematika sederhana.
 *
 * Pola penggunaan:
 *   const captchaRef = useRef(null)
 *   const { token, answer } = captchaRef.current.getValue()
 *   ... kirim bersama payload login/absen ...
 *   captchaRef.current.refresh()  // setelah submit / setelah error
 */
const Captcha = forwardRef(function Captcha({ onChange }, ref) {
  const [challenge, setChallenge] = useState(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const { data } = await api.get('/auth/captcha/')
      setChallenge(data)
      setAnswer('')
      onChange?.({ token: data.token, answer: '' })
    } catch (e) {
      setError(true)
      setChallenge(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useImperativeHandle(ref, () => ({
    getValue: () => ({ token: challenge?.token, answer }),
    refresh: load,
  }))

  const handleChange = (e) => {
    const v = e.target.value.replace(/[^0-9-]/g, '')
    setAnswer(v)
    onChange?.({ token: challenge?.token, answer: v })
  }

  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Verifikasi Keamanan
      </label>
      <div className="flex gap-2 items-stretch">
        <div className={`flex items-center gap-2 px-3 border rounded font-mono text-lg font-bold
                        tracking-wider min-w-[110px] justify-center select-none
                        ${error
                          ? 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-slate-300 bg-slate-50 text-ink-900'}`}>
          {error ? 'ERROR'
            : (loading || !challenge) ? '...'
            : `${challenge.question} = ?`}
        </div>
        <input
          type="text"
          inputMode="numeric"
          className="input flex-1"
          placeholder={error ? 'Server tidak merespons, tekan tombol muat ulang' : 'Jawaban'}
          value={answer}
          onChange={handleChange}
          disabled={error}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="btn-outline !px-3"
          title="Muat ulang soal"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-xs mt-1">
        {error ? (
          <span className="text-rose-700">
            Tidak dapat memuat verifikasi. Pastikan server aktif dan coba tekan tombol muat ulang.
          </span>
        ) : (
          <span className="text-ink-500">
            Hitung hasil operasi di atas untuk membuktikan bahwa Anda bukan program otomatis.
          </span>
        )}
      </p>
    </div>
  )
})

export default Captcha
