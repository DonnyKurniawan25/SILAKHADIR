import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Plus, Pencil, Trash2 } from 'lucide-react'
import Swal from 'sweetalert2'
import DataTable from '../../components/DataTable'
import ModalForm from '../../components/ModalForm'
import {
  createParticipant, deleteParticipant, listParticipants,
  updateParticipant, importParticipants, exportParticipantsUrl,
} from '../../api/eventApi'
import { downloadAuthed } from '../../utils/download'
import { useForm } from 'react-hook-form'

export default function ParticipantList({ eventId }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const fileRef = useRef(null)

  const load = () => listParticipants(eventId, { page_size: 500 })
    .then((r) => setRows(r.data.results || r.data))

  useEffect(() => { load() }, [eventId])

  const handleDelete = async (p) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning', title: 'Hapus peserta?', text: p.full_name,
      showCancelButton: true, confirmButtonColor: '#dc2626',
    })
    if (!isConfirmed) return
    await deleteParticipant(p.id); load()
  }

  const handleImport = async (file) => {
    try {
      const { data } = await importParticipants(eventId, file)
      Swal.fire({
        icon: 'success', title: 'Import selesai',
        text: `${data.created} ditambahkan, ${data.skipped} dilewati.`,
      })
      load()
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal import', text: e?.response?.data?.detail || 'Error' })
    }
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
      p.certificate_status === 'tersedia'
        ? <span className="badge-green">Tersedia</span>
        : <span className="badge-gray">Belum</span>
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
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])}
            />
            <button onClick={() => fileRef.current?.click()} className="btn-outline">
              <Upload className="w-4 h-4" /> Import Excel
            </button>
            <button
              type="button"
              onClick={() => downloadAuthed(exportParticipantsUrl(eventId), `peserta-${eventId}.xlsx`)}
              className="btn-outline"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => { setEditing(null); setOpen(true) }} className="btn-primary">
              <Plus className="w-4 h-4" /> Tambah Peserta
            </button>
          </>
        }
      />

      <ModalForm open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Peserta' : 'Tambah Peserta'}>
        <ParticipantForm
          eventId={eventId}
          participant={editing}
          onSaved={() => { setOpen(false); load() }}
        />
      </ModalForm>
    </div>
  )
}

function ParticipantForm({ eventId, participant, onSaved }) {
  const { register, handleSubmit, formState: { isSubmitting, errors }, watch } = useForm({
    defaultValues: participant || { is_asn: false, nip: '' },
  })
  const isAsn = watch('is_asn')
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
