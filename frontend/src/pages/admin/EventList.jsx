import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import Swal from 'sweetalert2'
import DataTable from '../../components/DataTable'
import ModalForm from '../../components/ModalForm'
import EventForm from './EventForm'
import { deleteEvent, listEvents } from '../../api/eventApi'
import { StatusBadge } from './Dashboard'

export default function EventList() {
  const [events, setEvents] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = () => listEvents({ page_size: 100 }).then((r) => setEvents(r.data.results || r.data))
  useEffect(() => { load() }, [])

  const handleEdit = (e) => { setEditing(e); setOpen(true) }
  const handleNew = () => { setEditing(null); setOpen(true) }

  const handleDelete = async (e) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Hapus kegiatan?',
      text: e.title,
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#991b1b',
    })
    if (!isConfirmed) return
    await deleteEvent(e.id)
    load()
    Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1200, showConfirmButton: false })
  }

  const columns = [
    {
      key: 'title',
      title: 'Nama Kegiatan',
      render: (e) => (
        <Link to={`/panel/kegiatan/${e.id}`} className="font-semibold text-brand-800 hover:underline">
          {e.title}
          <div className="text-xs text-ink-500 font-normal">{e.organizer || '-'}</div>
        </Link>
      ),
    },
    {
      key: 'start_date',
      title: 'Tanggal',
      render: (e) => new Date(e.start_date).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
    },
    { key: 'location', title: 'Lokasi' },
    {
      key: 'status', title: 'Status',
      render: (e) => <StatusBadge status={e.status_display} raw={e.status} />,
    },
    { key: 'total_participants', title: 'Peserta', className: 'text-right font-mono' },
    { key: 'total_attended', title: 'Hadir', className: 'text-right font-mono' },
    {
      key: 'actions', title: 'Aksi', className: 'text-right',
      render: (e) => (
        <div className="flex gap-1 justify-end">
          <a href={e.attendance_link} target="_blank" rel="noreferrer"
             title="Buka tautan absensi"
             className="btn-ghost !px-2 !py-1.5">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={() => handleEdit(e)} title="Ubah"
                  className="btn-ghost !px-2 !py-1.5">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(e)} title="Hapus"
                  className="btn-ghost !px-2 !py-1.5 text-rose-700">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <div className="eyebrow">Pengelolaan</div>
        <h1 className="section-title mt-1">Daftar Kegiatan</h1>
        <p className="text-ink-500 text-sm mt-1">
          Mengelola kegiatan yang diselenggarakan oleh instansi.
        </p>
      </div>

      <DataTable
        rows={events}
        columns={columns}
        actions={
          <button onClick={handleNew} className="btn-primary">
            <Plus className="w-4 h-4" /> Tambah Kegiatan
          </button>
        }
      />

      <ModalForm
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Ubah Kegiatan' : 'Tambah Kegiatan'}
        maxWidth="max-w-2xl"
      >
        <EventForm event={editing} onSaved={() => { setOpen(false); load() }} />
      </ModalForm>
    </div>
  )
}
