import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'
import { Calendar, Users2, CheckCircle2, Award } from 'lucide-react'
import Loading from '../../components/Loading'
import { dashboardStats } from '../../api/eventApi'
import { Link } from 'react-router-dom'

const COLORS = ['#0f2440', '#caa02f', '#b91c1c', '#5b6472']

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    dashboardStats().then((r) => setData(r.data)).catch(() => setData(null))
  }, [])

  if (!data) return <Loading />

  const pie = [
    { name: 'Hadir', value: data.attendance_summary.hadir },
    { name: 'Belum Hadir', value: data.attendance_summary.belum_hadir },
  ]

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <div className="eyebrow">Ringkasan</div>
        <h1 className="section-title mt-1">Dasbor Administrasi</h1>
        <p className="text-ink-500 text-sm mt-1">
          Ikhtisar kegiatan, peserta, dan sertifikat yang dikelola oleh instansi.
        </p>
      </div>

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-slate-200 rounded bg-white overflow-hidden">
        <StatCard icon={Calendar} label="Total Kegiatan" value={data.totals.events} />
        <StatCard icon={Users2} label="Peserta Terdaftar" value={data.totals.participants} border />
        <StatCard icon={CheckCircle2} label="Peserta Hadir" value={data.totals.attended} border />
        <StatCard icon={Award} label="Sertifikat Diterbitkan" value={data.totals.certificates} border />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2 p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="eyebrow">Statistik</div>
            <h3 className="font-serif font-bold text-ink-900 mt-0.5">Peserta per Kegiatan</h3>
            <p className="text-xs text-ink-500">Sepuluh kegiatan terbaru</p>
          </div>
          <div className="h-80 p-3">
            <ResponsiveContainer>
              <BarChart data={data.participants_per_event} margin={{ top: 8, right: 8, bottom: 50, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="title" tick={{ fontSize: 10, fill: '#5b6472' }} interval={0}
                       angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5b6472' }} />
                <Tooltip contentStyle={{ borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="participants_count" name="Terdaftar" fill="#0f2440" />
                <Bar dataKey="attended_count" name="Hadir" fill="#caa02f" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="eyebrow">Kehadiran</div>
            <h3 className="font-serif font-bold text-ink-900 mt-0.5">Komposisi Kehadiran</h3>
            <p className="text-xs text-ink-500">Ringkasan seluruh kegiatan</p>
          </div>
          <div className="h-80 p-3">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={1}>
                  {pie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-slate-200">
          <div>
            <div className="eyebrow">Arsip</div>
            <h3 className="font-serif font-bold text-ink-900 mt-0.5">Kegiatan Terbaru</h3>
          </div>
          <Link to="/admin/kegiatan" className="text-sm text-brand-700 hover:underline">Lihat semua</Link>
        </div>
        <table className="table-base">
          <thead>
            <tr>
              <th>Kegiatan</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th className="text-right pr-4">Peserta</th>
              <th className="text-right pr-4">Hadir</th>
            </tr>
          </thead>
          <tbody>
            {data.recent_events.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link to={`/admin/kegiatan/${e.id}`} className="font-semibold text-brand-800 hover:underline">
                    {e.title}
                  </Link>
                  <div className="text-xs text-ink-500">{e.organizer}</div>
                </td>
                <td>{new Date(e.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td><StatusBadge status={e.status_display} raw={e.status} /></td>
                <td className="text-right pr-4 font-mono">{e.total_participants}</td>
                <td className="text-right pr-4 font-mono">{e.total_attended}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, border }) {
  return (
    <div className={`p-5 ${border ? 'border-l border-slate-200' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="eyebrow">{label}</div>
        <Icon className="w-4 h-4 text-ink-500" />
      </div>
      <div className="font-serif font-extrabold text-3xl text-ink-900 mt-2 tracking-tight">
        {value}
      </div>
    </div>
  )
}

export function StatusBadge({ status, raw }) {
  const map = {
    draft: 'badge-gray',
    open: 'badge-blue',
    closed: 'badge-yellow',
    done: 'badge-green',
  }
  return <span className={map[raw] || 'badge-gray'}>{status}</span>
}
