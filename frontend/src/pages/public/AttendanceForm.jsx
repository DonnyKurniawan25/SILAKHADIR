import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import SignatureCanvas from 'react-signature-canvas'
import { publicEventInfo, submitAttendance } from '../../api/attendanceApi'
import { Calendar, MapPin, Building2, Loader2, AlertCircle } from 'lucide-react'
import Swal from 'sweetalert2'
import Captcha from '../../components/Captcha'

export default function AttendanceForm() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm({
    defaultValues: { is_asn: false, nip: '' },
  })
  const sigRef = useRef(null)
  const captchaRef = useRef(null)

  useEffect(() => {
    publicEventInfo(slug)
      .then((r) => setEvent(r.data))
      .catch(() => setEvent(null))
      .finally(() => setLoading(false))
  }, [slug])

  const onSubmit = async (data) => {
    const captcha = captchaRef.current?.getValue()
    if (!captcha?.token || !captcha?.answer) {
      Swal.fire({ icon: 'warning', title: 'Verifikasi Keamanan', text: 'Mohon isi jawaban verifikasi.' })
      return
    }

    const signature = sigRef.current && !sigRef.current.isEmpty()
      ? sigRef.current.getCanvas().toDataURL('image/png')
      : null

    try {
      await submitAttendance(slug, {
        ...data,
        nip: data.is_asn ? data.nip : '',
        signature,
        captcha_token: captcha.token,
        captcha_answer: captcha.answer,
      })
      navigate(`/absensi/${slug}/sukses`, { state: { event_title: event?.title, name: data.full_name } })
    } catch (e) {
      captchaRef.current?.refresh()
      const resp = e?.response?.data || {}

      // Kasus khusus: sudah pernah absen
      if (resp.code === 'already_attended') {
        Swal.fire({
          icon: 'info',
          title: 'Sudah Terdaftar Hadir',
          text: resp.detail || 'Anda sudah tercatat hadir pada kegiatan ini.',
          confirmButtonText: 'Mengerti',
        })
        return
      }

      const msg = resp.captcha?.[0]
        || resp.detail
        || Object.values(resp)?.[0]
        || 'Gagal mengirim absensi.'
      Swal.fire({ icon: 'error', title: 'Gagal Absensi', text: String(msg) })
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-brand-700" />
      </div>
    )
  }
  if (!event) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="border border-rose-200 bg-rose-50 rounded p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-700 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Kegiatan tidak ditemukan</div>
            <p className="text-sm text-rose-800 mt-1">
              Tautan absensi tidak valid atau telah berakhir masa berlakunya.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const accepting = event.attendance_open && event.status === 'open'
  const isAsn = watch('is_asn')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Kop kegiatan */}
      <div className="border border-slate-200 rounded bg-white mb-5 overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <div className="eyebrow">Formulir Daftar Hadir</div>
          <h1 className="font-serif font-bold text-2xl text-ink-900 mt-1">{event.title}</h1>
          {event.theme && <p className="text-ink-700 mt-1">{event.theme}</p>}
          <div className="mt-3 grid sm:grid-cols-3 gap-2 text-sm text-ink-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(event.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            {event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
            {event.organizer && <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{event.organizer}</div>}
          </div>
        </div>
        <div className="gov-divider" />
      </div>

      {!accepting && (
        <div className="border border-amber-200 bg-amber-50 rounded p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">Absensi ditutup</div>
            <p className="text-sm text-amber-800">
              Pengisian daftar hadir kegiatan ini sedang tidak dibuka. Silakan hubungi penyelenggara.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
        <div>
          <div className="eyebrow mb-3">A. Data Identitas</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nomor NIK</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength={16}
                {...register('nik', {
                  required: 'NIK wajib diisi',
                  pattern: { value: /^[0-9]+$/, message: 'Hanya angka' },
                  minLength: { value: 16, message: 'NIK harus 16 digit' },
                  maxLength: { value: 16, message: 'NIK harus 16 digit' },
                })}
              />
              {errors.nik && <p className="text-xs text-rose-600 mt-1">{errors.nik.message}</p>}
            </div>
            <div>
              <label className="label">Jenis Peserta</label>
              <label className="flex items-center gap-2 h-10 px-3 border border-slate-300 rounded bg-white text-sm">
                <input type="checkbox" {...register('is_asn')} />
                Saya adalah ASN
              </label>
            </div>
          </div>
          {isAsn && (
            <div className="mt-3">
              <label className="label">Nomor NIP</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength={18}
                {...register('nip', {
                  required: 'NIP wajib diisi untuk ASN',
                  pattern: { value: /^[0-9]+$/, message: 'Hanya angka' },
                  minLength: { value: 18, message: 'NIP harus 18 digit' },
                  maxLength: { value: 18, message: 'NIP harus 18 digit' },
                })}
              />
              {errors.nip && <p className="text-xs text-rose-600 mt-1">{errors.nip.message}</p>}
            </div>
          )}
          <div className="mt-3">
            <label className="label">Nama Lengkap</label>
            <input className="input" {...register('full_name', { required: 'Nama wajib diisi' })} />
            {errors.full_name && <p className="text-xs text-rose-600 mt-1">{errors.full_name.message}</p>}
          </div>
        </div>

        <hr className="border-slate-200" />

        <div>
          <div className="eyebrow mb-3">B. Data Instansi</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Instansi / OPD / Desa</label>
              <input className="input" {...register('institution')} />
            </div>
            <div>
              <label className="label">Jabatan</label>
              <input className="input" {...register('position')} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">Nomor HP</label>
              <input className="input" inputMode="tel" {...register('phone')} />
            </div>
            <div>
              <label className="label">Surel</label>
              <input type="email" className="input" {...register('email', {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Surel tidak valid' },
              })} />
              {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div>
          <div className="eyebrow mb-2">C. Tanda Tangan</div>
          <p className="text-xs text-ink-500 mb-2">
            Tanda tangani dengan mouse atau jari pada kotak di bawah ini.
          </p>
          <div className="border border-slate-300 rounded bg-white">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{ className: 'w-full h-40' }}
              penColor="#0f2440"
            />
          </div>
          <div className="mt-2 text-right">
            <button type="button" onClick={() => sigRef.current?.clear()}
                    className="text-xs text-ink-500 hover:text-rose-600">
              Bersihkan tanda tangan
            </button>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div>
          <div className="eyebrow mb-2">D. Verifikasi Keamanan</div>
          <Captcha ref={captchaRef} />
        </div>

        <div className="pt-2 border-t border-slate-200">
          <button type="submit" disabled={isSubmitting || !accepting} className="btn-primary w-full">
            {isSubmitting ? 'Mengirim...' : 'Kirim Daftar Hadir'}
          </button>
          <p className="text-[11px] text-ink-500 mt-2 text-center">
            Dengan mengirim, Anda menyatakan data yang diisi adalah benar.
          </p>
        </div>
      </form>
    </div>
  )
}
