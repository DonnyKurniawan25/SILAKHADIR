import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Upload, FileText, UserPlus } from 'lucide-react'
import Swal from 'sweetalert2'
import ModalForm from '../../components/ModalForm'
import { uploadCertificate } from '../../api/certificateApi'
import { listParticipants } from '../../api/eventApi'

export default function UploadCertificateModal({ open, onClose, eventId, onUploaded }) {
  const [participants, setParticipants] = useState([])
  const [mode, setMode] = useState('existing') // existing | new
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, watch, reset } = useForm()
  const isAsn = watch('is_asn')

  useEffect(() => {
    if (!open) return
    listParticipants(eventId, { page_size: 500 })
      .then((r) => setParticipants(r.data.results || r.data))
    reset({ mode: 'existing' })
    setMode('existing')
  }, [open, eventId, reset])

  const onSubmit = async (data) => {
    if (!data.pdf_file?.length) {
      Swal.fire({ icon: 'warning', title: 'File PDF wajib diunggah' })
      return
    }
    if (!data.certificate_number?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nomor sertifikat wajib diisi' })
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        pdfFile: data.pdf_file[0],
        certificateNumber: data.certificate_number.trim(),
      }
      if (mode === 'existing') {
        if (!data.participant_id) {
          setSubmitting(false)
          Swal.fire({ icon: 'warning', title: 'Pilih peserta' })
          return
        }
        payload.participantId = data.participant_id
      } else {
        payload.newParticipant = {
          nik: data.nik?.trim(),
          nip: data.is_asn ? data.nip?.trim() : '',
          is_asn: Boolean(data.is_asn),
          full_name: data.full_name?.trim(),
          institution: data.institution || '',
          position: data.position || '',
          phone: data.phone || '',
          email: data.email || '',
        }
        if (!payload.newParticipant.nik || !payload.newParticipant.full_name) {
          setSubmitting(false)
          Swal.fire({ icon: 'warning', title: 'NIK dan Nama wajib diisi' })
          return
        }
        if (payload.newParticipant.is_asn && !payload.newParticipant.nip) {
          setSubmitting(false)
          Swal.fire({ icon: 'warning', title: 'NIP wajib diisi untuk ASN' })
          return
        }
      }
      await uploadCertificate(eventId, payload)
      Swal.fire({ icon: 'success', title: 'Sertifikat terupload', timer: 1400, showConfirmButton: false })
      onUploaded?.()
      onClose?.()
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal upload',
        text: e?.response?.data?.detail || JSON.stringify(e?.response?.data || {}),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalForm open={open} onClose={onClose} title="Upload Sertifikat" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Tab mode */}
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
              mode === 'existing' ? 'bg-white shadow text-brand-800' : 'text-slate-500'
            }`}
          >
            Peserta Terdaftar
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              mode === 'new' ? 'bg-white shadow text-brand-800' : 'text-slate-500'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Peserta Baru
          </button>
        </div>

        {mode === 'existing' ? (
          <div>
            <label className="label">Peserta *</label>
            <select className="input" {...register('participant_id')}>
              <option value="">-- Pilih peserta --</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · {p.nik}
                </option>
              ))}
            </select>
            {participants.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Belum ada peserta terdaftar. Gunakan tab "Peserta Baru".
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 p-3 border border-dashed border-brand-300 rounded-xl bg-brand-50/40">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">NIK *</label>
                <input className="input" inputMode="numeric" maxLength={16} {...register('nik')} />
              </div>
              <div>
                <label className="label">Jenis Peserta</label>
                <label className="flex items-center gap-2 h-10 px-3 border border-slate-300 rounded bg-white text-sm">
                  <input type="checkbox" {...register('is_asn')} />
                  ASN
                </label>
              </div>
            </div>
            {isAsn && (
              <div>
                <label className="label">NIP *</label>
                <input className="input" inputMode="numeric" maxLength={18} {...register('nip')} />
              </div>
            )}
            <div>
              <label className="label">Nama Lengkap *</label>
              <input className="input" {...register('full_name')} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><label className="label">Instansi</label><input className="input" {...register('institution')} /></div>
              <div><label className="label">Jabatan</label><input className="input" {...register('position')} /></div>
            </div>
          </div>
        )}

        <div>
          <label className="label">Nomor Sertifikat *</label>
          <input
            className="input font-mono"
            placeholder="Contoh: 001/DISKOMINFO/BIMTEK/V/2026"
            {...register('certificate_number', { required: true })}
          />
          <p className="text-xs text-slate-500 mt-1">
            Nomor boleh sama antar sertifikat.
          </p>
        </div>

        <div>
          <label className="label">File PDF Sertifikat *</label>
          <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-brand-500 hover:bg-brand-50">
            <FileText className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-500">
              {watch('pdf_file')?.[0]?.name || 'Klik untuk pilih file PDF (maks 20MB)'}
            </span>
            <input type="file" accept="application/pdf" className="hidden"
                   {...register('pdf_file', { required: true })} />
          </label>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          <Upload className="w-4 h-4" />
          {submitting ? 'Mengunggah...' : 'Upload Sertifikat'}
        </button>
      </form>
    </ModalForm>
  )
}
