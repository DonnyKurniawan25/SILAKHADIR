import { useEffect, useState, useRef } from 'react'
import { Download, Upload, Plus, Pencil, Trash2 } from 'lucide-react'
import Swal from 'sweetalert2'
import DataTable from '../../components/DataTable'
import ModalForm from '../../components/ModalForm'
import {
  createParticipant, deleteParticipant, listParticipants,
  updateParticipant, lookupParticipantSystem,
} from '../../api/eventApi'
import AttendanceUploadModal from './AttendanceUploadModal'
import { downloadAttendanceXlsx } from '../../api/finalImportApi'
import { importError } from '../../utils/importWorkflow.mjs'
import { certificateHistoryLabel } from '../../utils/certificateHistory.mjs'
import { useForm } from 'react-hook-form'

export default function ParticipantList({ eventId, onChanged, refreshVersion }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = () => listParticipants(eventId, { page_size: 500 })
    .then((r) => setRows(r.data.results || r.data))

  useEffect(() => { load() }, [eventId, refreshVersion])

  const handleDelete = async (p) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning', title: 'Hapus peserta?', text: p.full_name,
      showCancelButton: true, confirmButtonColor: '#dc2626',
    })
    if (!isConfirmed) return
    await deleteParticipant(p.id); load(); onChanged?.()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadAttendanceXlsx(eventId, 'export')
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Ekspor absensi gagal', text: importError(e, 'Berkas Excel gagal diunduh.') })
    } finally { setExporting(false) }
  }

  const columns = [
    { key: 'full_name', title: 'Nama', render: (p) => (
      <>
        <div className="font-semibold">{p.full_name}</div>
        <div className="text-xs text-slate-500">{p.institution}</div>
      </>
    )},
    { key: 'nik', title: 'NIK', render: (p) => (
      <div className="font-mono text-xs">{p.nik}</div>
    )},
    { key: 'nip', title: 'NIP', render: (p) => (
      <div className="font-mono text-xs">
        {p.nip || <span className="text-slate-400">—</span>}
      </div>
    )},
    { key: 'position', title: 'Jabatan' },
    { key: 'attendance_status', title: 'Kehadiran', render: (p) => (
      p.attendance_status === 'hadir'
        ? <span className="badge-green">Hadir</span>
        : <span className="badge-gray">Belum</span>
    )},
    { key: 'certificate_status', title: 'Sertifikat', render: (p) => (
      <div className="space-y-1">
        <div>{p.certificate_status === 'tersedia'
          ? <span className="badge-green">Tersedia pada kegiatan ini</span>
          : <span className="badge-gray">Belum pada kegiatan ini</span>}</div>
        {certificateHistoryLabel(p.certificate_history) && <div>
          <span className="badge-green" title={(p.certificate_history.events || []).map((event) => event.title).filter(Boolean).join(' · ')}>{certificateHistoryLabel(p.certificate_history)}</span>
        </div>}
      </div>
    )},
    { key: 'actions', title: 'Aksi', className: 'text-right', render: (p) => (
      <div className="flex gap-1 justify-end">
        <button onClick={() => { setEditing(p); setOpen(true) }} className="btn-ghost !px-2 !py-1.5"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => handleDelete(p)} className="btn-ghost !px-2 !py-1.5 text-rose-600"><Trash2 className="w-4 h-4" /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-3">
      <DataTable
        rows={rows}
        columns={columns}
        emptyText="Belum ada peserta."
        actions={
          <>
            <button disabled={exporting} onClick={() => setAttendanceOpen(true)} className="btn-outline">
              <Upload className="w-4 h-4" /> Unggah Absensi Excel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="btn-outline"
            >
              <Download className="w-4 h-4" /> {exporting ? 'Mengunduh...' : 'Ekspor Absensi .xlsx'}
            </button>
            <button onClick={() => { setEditing(null); setOpen(true) }} className="btn-primary">
              <Plus className="w-4 h-4" /> Tambah Peserta
            </button>
          </>
        }
      />

      <AttendanceUploadModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)} eventId={eventId} onImported={() => { load(); onChanged?.() }} />
      <ModalForm open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Peserta' : 'Tambah Peserta'}>
        <ParticipantForm
          eventId={eventId}
          participant={editing}
          onSaved={() => { setOpen(false); load(); onChanged?.() }}
        />
      </ModalForm>
    </div>
  )
}

function ParticipantForm({ eventId, participant, onSaved }) {
  const { register, handleSubmit, formState: { isSubmitting, errors }, watch, setValue } = useForm({
    defaultValues: participant || { is_asn: false, nip: '' },
  })
  const isAsn = watch('is_asn')
  const nikValue = watch('nik')
  const nipValue = watch('nip')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupFeedback, setLookupFeedback] = useState(null)
  const lastLookedUpRef = useRef({ nik: '', nip: '' })

  const triggerLookup = async ({ nik, nip }) => {
    if (participant?.id && !nik && !nip) return
    const cleanNik = (nik || '').trim()
    const cleanNip = (nip || '').trim()
    if (!cleanNik && !cleanNip) return

    if (cleanNik && lastLookedUpRef.current.nik === cleanNik) return
    if (cleanNip && lastLookedUpRef.current.nip === cleanNip) return

    try {
      setLookingUp(true)
      const params = {}
      if (cleanNik) params.nik = cleanNik
      if (cleanNip) params.nip = cleanNip
      const res = await lookupParticipantSystem(eventId, params)
      if (res.data?.found) {
        const d = res.data
        if (cleanNik) lastLookedUpRef.current.nik = cleanNik
        if (cleanNip) lastLookedUpRef.current.nip = cleanNip

        if (d.full_name) setValue('full_name', d.full_name, { shouldValidate: true })
        if (d.nik) setValue('nik', d.nik, { shouldValidate: true })
        if (d.nip) {
          setValue('nip', d.nip, { shouldValidate: true })
          setValue('is_asn', true, { shouldValidate: true })
        }
        if (d.institution) setValue('institution', d.institution)
        if (d.position) setValue('position', d.position)
        if (d.phone) setValue('phone', d.phone)
        if (d.email) setValue('email', d.email)

        setLookupFeedback({
          type: 'success',
          text: `Data "${d.full_name}" ditemukan di sistem dan terisi otomatis.`,
        })
      } else {
        if (cleanNik) lastLookedUpRef.current.nik = cleanNik
        if (cleanNip) lastLookedUpRef.current.nip = cleanNip
      }
    } catch {
      // ignore
    } finally {
      setLookingUp(false)
    }
  }

  useEffect(() => {
    const v = (nikValue || '').trim()
    if (v.length === 16) triggerLookup({ nik: v })
  }, [nikValue])

  useEffect(() => {
    const v = (nipValue || '').trim()
    if (v.length === 18) triggerLookup({ nip: v })
  }, [nipValue])

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, nip: data.is_asn ? data.nip : '' }
      if (participant?.id) await updateParticipant(participant.id, payload)
      else await createParticipant(eventId, payload)
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1200, showConfirmButton: false })
      onSaved?.()
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: JSON.stringify(e?.response?.data || {}) })
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {lookingUp && (
        <div className="text-xs text-blue-600 flex items-center gap-1.5 py-1">
          <span className="inline-block w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          Memeriksa data di sistem...
        </div>
      )}
      {lookupFeedback && (
        <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 rounded flex items-center justify-between">
          <span>{lookupFeedback.text}</span>
          <button type="button" onClick={() => setLookupFeedback(null)} className="text-emerald-500 hover:text-emerald-800 ml-2">✕</button>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">NIK *</label>
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
            onBlur={() => {
              const v = (nikValue || '').trim()
              if (v.length >= 10) triggerLookup({ nik: v })
            }}
          />
          {errors.nik && <p className="text-xs text-rose-600 mt-1">{errors.nik.message}</p>}
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
            onBlur={() => {
              const v = (nipValue || '').trim()
              if (v.length >= 10) triggerLookup({ nip: v })
            }}
          />
          {errors.nip && <p className="text-xs text-rose-600 mt-1">{errors.nip.message}</p>}
        </div>
      )}
      <div>
        <label className="label">Nama *</label>
        <input className="input" {...register('full_name', { required: true })} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Instansi</label><input className="input" {...register('institution')} /></div>
        <div><label className="label">Jabatan</label><input className="input" {...register('position')} /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className="label">No. HP</label><input className="input" {...register('phone')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" {...register('email')} /></div>
      </div>
      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  )
}
