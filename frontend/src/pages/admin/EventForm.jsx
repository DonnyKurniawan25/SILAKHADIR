import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { createEvent, updateEvent } from '../../api/eventApi'
import Swal from 'sweetalert2'

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventForm({ event, onSaved }) {
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm()

  useEffect(() => {
    reset({
      ...event,
      start_date: toLocalInput(event?.start_date),
      end_date: toLocalInput(event?.end_date),
      status: event?.status || 'draft',
      attendance_open: event?.attendance_open ?? true,
    })
  }, [event, reset])

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
      }
      const res = event?.id
        ? await updateEvent(event.id, payload)
        : await createEvent(payload)
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1400, showConfirmButton: false })
      onSaved?.(res.data)
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: JSON.stringify(e?.response?.data || {}) })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <div className="eyebrow mb-3">A. Identitas Kegiatan</div>
        <div className="space-y-3">
          <div>
            <label className="label">Nama Kegiatan *</label>
            <input className="input" {...register('title', { required: 'Wajib diisi' })} />
            {errors.title && <p className="text-xs text-rose-700 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Tema</label>
            <input className="input" {...register('theme')} />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input" rows={3} {...register('description')} />
          </div>
        </div>
      </div>

      <hr className="border-slate-200" />

      <div>
        <div className="eyebrow mb-3">B. Jadwal dan Lokasi</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Tanggal Mulai *</label>
            <input type="datetime-local" className="input" {...register('start_date', { required: true })} />
          </div>
          <div>
            <label className="label">Tanggal Selesai *</label>
            <input type="datetime-local" className="input" {...register('end_date', { required: true })} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Lokasi</label>
            <input className="input" {...register('location')} />
          </div>
          <div>
            <label className="label">Penyelenggara</label>
            <input className="input" {...register('organizer')} />
          </div>
        </div>
      </div>

      <hr className="border-slate-200" />

      <div>
        <div className="eyebrow mb-3">C. Status</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Status Kegiatan</label>
            <select className="input" {...register('status')}>
              <option value="draft">Draf</option>
              <option value="open">Dibuka</option>
              <option value="closed">Ditutup</option>
              <option value="done">Selesai</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 p-2">
              <input type="checkbox" {...register('attendance_open')} className="w-4 h-4" />
              <span className="text-sm">Formulir daftar hadir dibuka</span>
            </label>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200">
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
