import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'
import { Calendar, Users2, CheckCircle2, Award, ClipboardList, FileText, Download, User, Pencil } from 'lucide-react'
import Loading from '../../components/Loading'
import { dashboardStats } from '../../api/eventApi'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { listPeriodes } from '../../api/kinerjaApi'
import { checkCertificate } from '../../api/certificateApi'

const COLORS = ['#0f2440', '#caa02f', '#b91c1c', '#5b6472']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [data, setData] = useState(null)
  const [periodes, setPeriodes] = useState([])
  const [certs, setCerts] = useState([])
  const [loadingCerts, setLoadingCerts] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      dashboardStats().then((r) => setData(r.data)).catch(() => setData(null))
    } else {
      // Operator (pegawai)
      listPeriodes({ page_size: 20 })
        .then((r) => setPeriodes(r.data.results || r.data))
        .catch(() => {})

      if (user?.nip) {
        setLoadingCerts(true)
        checkCertificate(user.nip)
          .then((r) => {
            if (r.data.found) {
              setCerts(r.data.results || [])
            }
          })
          .catch(() => {})
          .finally(() => setLoadingCerts(false))
      }
    }
  }, [isAdmin, user?.nip])

  // RENDER UNTUK PEGAWAI / OPERATOR
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* Welcome Header Profile */}
        <div className="border border-slate-200 rounded bg-white shadow-card overflow-hidden">
          <div className="p-6 bg-brand-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20">
                <User className="w-8 h-8" />
              </div>
              <div>
                <div className="eyebrow text-gold-400 font-bold uppercase tracking-wider text-xs">Akun Pegawai</div>
                <h1 className="font-serif font-bold text-2xl tracking-tight">
                  {user?.first_name || user?.username}
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  NIP: <span className="font-mono">{user?.nip || '-'}</span> | Jabatan: {user?.jabatan || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/profil')}
                className="btn text-xs bg-white/20 text-white hover:bg-white/30 border border-white/10 !py-1.5 !px-3 font-semibold flex items-center gap-1"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Profil & Sandi
              </button>
              <span className="badge badge-yellow">Pegawai Aktif</span>
            </div>
          </div>
          <div className="gov-divider" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Kolom Kinerja */}
          <div className="card space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="eyebrow">Pencatatan</div>
              <h2 className="font-serif font-bold text-lg text-ink-900 flex items-center gap-1.5 mt-0.5">
                <ClipboardList className="w-5 h-5 text-brand-700" /> Kinerja Harian Periode Aktif
              </h2>
              <p className="text-xs text-ink-500 mt-1">
                Pilih periode untuk mencatat kinerja Anda sendiri atau mencetak laporan.
              </p>
            </div>

            {periodes.length === 0 ? (
              <div className="text-center py-6 text-ink-400 text-sm">
                Belum ada periode kinerja yang tersedia.
              </div>
            ) : (
              <div className="space-y-3">
                {periodes.map((p) => {
                  const isClosed = p.status === 'ditutup'
                  return (
                    <div key={p.id} className="p-4 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100/50 transition flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <div className="font-bold text-ink-900 text-sm">{p.nama}</div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          Bidang: {p.bidang} — {isClosed ? 'Ditutup' : 'Aktif'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => navigate(`/admin/kinerja/${p.id}`)}
                          className="btn text-xs bg-brand-800 text-white hover:bg-brand-900 !py-1.5 !px-3 font-semibold"
                        >
                          Catat Kinerja
                        </button>
                        <button
                          onClick={() => navigate(`/admin/kinerja/${p.id}/laporan/${user?.nip}`)}
                          className="btn text-xs bg-slate-200 text-ink-800 hover:bg-slate-300 !py-1.5 !px-3 font-semibold flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" /> Laporan A4
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kolom Sertifikat */}
          <div className="card space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="eyebrow">Sertifikasi</div>
              <h2 className="font-serif font-bold text-lg text-ink-900 flex items-center gap-1.5 mt-0.5">
                <Award className="w-5 h-5 text-brand-700" /> Sertifikat Kegiatan Saya
              </h2>
              <p className="text-xs text-ink-500 mt-1">
                Daftar sertifikat digital dari kegiatan yang telah Anda ikuti dan selesaikan.
              </p>
            </div>

            {loadingCerts ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
              </div>
            ) : certs.length === 0 ? (
              <div className="text-center py-10 text-ink-400 text-sm border border-dashed border-slate-200 rounded">
                <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Belum ada sertifikat terdaftar untuk NIP Anda.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {certs.map((c) => (
                  <div key={c.id} className="p-4 border border-slate-200 rounded hover:shadow-sm transition flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900 text-sm truncate">{c.event_title}</div>
                      <div className="text-[11px] text-ink-500 mt-0.5">
                        No: <span className="font-mono">{c.certificate_number}</span>
                      </div>
                      <div className="text-[10px] text-ink-400">Penyelenggara: {c.organizer}</div>
                    </div>
                    <a
                      href={c.download_url}
                      className="btn text-xs bg-emerald-700 text-white hover:bg-emerald-800 !py-1.5 !px-3 font-semibold flex items-center gap-1 flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // RENDER UNTUK ADMIN / SUPERADMIN
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
