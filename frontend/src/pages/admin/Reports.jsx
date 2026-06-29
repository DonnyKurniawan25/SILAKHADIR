import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, FileBarChart2 } from 'lucide-react'
import { listEvents } from '../../api/eventApi'
import { attendanceReport, reportExcelUrl, reportPdfUrl } from '../../api/reportApi'
import { downloadAuthed } from '../../utils/download'
import Loading from '../../components/Loading'

export default function Reports() {
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listEvents({ page_size: 100 }).then((r) => setEvents(r.data.results || r.data))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    attendanceReport(selected)
      .then((r) => setReport(r.data))
      .finally(() => setLoading(false))
  }, [selected])

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-3">
        <div className="eyebrow">Dokumen</div>
        <h1 className="section-title mt-1">Laporan dan Rekapitulasi</h1>
        <p className="text-ink-500 text-sm mt-1">
          Rekap kehadiran per kegiatan. Tersedia unduhan dalam format Excel dan PDF.
        </p>
      </div>

      <div className="card">
        <label className="label">Pilih Kegiatan</label>
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">-- Pilih kegiatan --</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        {selected && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadAuthed(reportExcelUrl(selected), `rekap-${selected}.xlsx`)}
              className="btn-outline"
            >
              <FileSpreadsheet className="w-4 h-4" /> Unduh Excel
            </button>
            <button
              type="button"
              onClick={() => downloadAuthed(reportPdfUrl(selected), `rekap-${selected}.pdf`)}
              className="btn-outline"
            >
              <FileText className="w-4 h-4" /> Unduh PDF
            </button>
          </div>
        )}
      </div>

      {loading && <Loading />}

      {report && (
        <>
          <div className="grid grid-cols-3 gap-0 border border-slate-200 rounded bg-white overflow-hidden">
            <Stat label="Total Peserta" value={report.total} />
            <Stat label="Hadir" value={report.hadir_count} border accent="emerald" />
            <Stat label="Belum Hadir" value={report.belum_count} border accent="rose" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <ReportTable title="Daftar Peserta Hadir" rows={report.hadir} />
            <ReportTable title="Daftar Peserta Belum Hadir" rows={report.belum_hadir} />
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="border border-slate-200 rounded bg-white p-10 text-center">
          <FileBarChart2 className="w-10 h-10 mx-auto text-ink-300" />
          <p className="mt-2 text-ink-500">Pilih kegiatan di atas untuk menampilkan rekapitulasi.</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, border, accent }) {
  const palette = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    default: 'text-ink-900',
  }
  return (
    <div className={`p-5 ${border ? 'border-l border-slate-200' : ''}`}>
      <div className="eyebrow">{label}</div>
      <div className={`font-serif font-extrabold text-3xl mt-2 ${palette[accent] || palette.default}`}>
        {value}
      </div>
    </div>
  )
}

function ReportTable({ title, rows }) {
  return (
    <div className="card p-0 overflow-hidden">
      <h3 className="font-serif font-bold text-ink-900 p-4 border-b border-slate-200">
        {title} <span className="text-ink-500 font-sans font-normal">({rows.length})</span>
      </h3>
      <table className="table-base">
        <thead><tr><th>Nama</th><th>NIK</th><th>NIP</th><th>Instansi</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="text-center py-6 text-ink-500">Tidak ada data</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.nik}>
              <td className="font-semibold">{r.full_name}</td>
              <td className="font-mono text-xs">{r.nik}</td>
              <td className="font-mono text-xs">{r.nip || '-'}</td>
              <td>{r.institution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
