import { useEffect, useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import DataTable from '../../components/DataTable'
import { listCertificates } from '../../api/certificateApi'
import { useAuth } from '../../context/AuthContext'

export default function CertificateList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [rows, setRows] = useState([])

  useEffect(() => {
    listCertificates({ page_size: 200 })
      .then((r) => setRows(r.data.results || r.data))
  }, [])

  const columns = [
    {
      key: 'certificate_number', title: 'No. Sertifikat',
      render: (c) => <span className="font-mono text-xs">{c.certificate_number}</span>,
    },
    {
      key: 'participant_name', title: 'Nama Peserta',
      render: (c) => (
        <>
          <div className="font-semibold">{c.participant_name}</div>
          <div className="text-xs text-ink-500 font-mono">{c.nik}</div>
        </>
      ),
    },
    { key: 'event_title', title: 'Kegiatan' },
    { key: 'status', title: 'Status', render: (c) => <span className="badge-green">{c.status}</span> },
    {
      key: 'generated_at', title: 'Diterbitkan',
      render: (c) => new Date(c.generated_at).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
    },
    {
      key: 'actions', title: 'Tindakan', className: 'text-right',
      render: (c) => (
        <div className="flex gap-2 justify-end">
          <a href={c.verify_url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" /> Verifikasi
          </a>
          <a href={c.download_url} className="btn-primary !px-3 !py-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Unduh
          </a>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <div className="eyebrow">{isAdmin ? 'Arsip' : 'Sertifikasi'}</div>
        <h1 className="section-title mt-1">{isAdmin ? 'Daftar Sertifikat' : 'Sertifikat Saya'}</h1>
        <p className="text-ink-500 text-sm mt-1">
          {isAdmin
            ? 'Seluruh sertifikat yang pernah diterbitkan oleh sistem.'
            : 'Daftar sertifikat kegiatan yang Anda ikuti.'}
        </p>
      </div>
      <DataTable rows={rows} columns={columns} />
    </div>
  )
}
