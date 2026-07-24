import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Download, Loader2, Pencil, CalendarDays } from 'lucide-react'
import { getLaporan, getPeriode, updatePeriode } from '../../api/kinerjaApi'
import Swal from 'sweetalert2'
import { useAuth } from '../../context/AuthContext'

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export default function KinerjaLaporanPegawaiDetail() {
  const { id, nip } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [periode, setPeriode] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterTanggal, setFilterTanggal] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [periodeRes, laporanRes] = await Promise.all([
        getPeriode(id),
        getLaporan(id, { nip }),
      ])
      setPeriode(periodeRes.data)
      const dataPegawai = laporanRes.data.laporan?.find((l) => l.nip_pegawai === nip)
      setReportData(dataPegawai || null)
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal memuat laporan pegawai' })
    }
    setLoading(false)
  }, [id, nip])

  const [showKabidModal, setShowKabidModal] = useState(false)
  const [kabidNama, setKabidNama] = useState('')
  const [kabidNip, setKabidNip] = useState('')
  const [savingKabid, setSavingKabid] = useState(false)
  const [showPegawaiTtd, setShowPegawaiTtd] = useState(true)
  const [showKabidTtd, setShowKabidTtd] = useState(true)
  const [showNomorNaskah, setShowNomorNaskah] = useState(true)

  useEffect(() => {
    if (periode) {
      setKabidNama(periode.kepala_bidang_nama || '')
      setKabidNip(periode.kepala_bidang_nip || '')
    }
  }, [periode])

  const handleSaveKabid = async (e) => {
    e.preventDefault()
    setSavingKabid(true)
    try {
      await updatePeriode(id, {
        nama: periode.nama,
        bulan: periode.bulan,
        tahun: periode.tahun,
        bidang: periode.bidang,
        deskripsi: periode.deskripsi,
        status: periode.status,
        kepala_bidang_nama: kabidNama,
        kepala_bidang_nip: kabidNip,
      })
      setPeriode({
        ...periode,
        kepala_bidang_nama: kabidNama,
        kepala_bidang_nip: kabidNip,
      })
      setShowKabidModal(false)
      Swal.fire({ icon: 'success', title: 'Data Kepala Bidang diperbarui!', timer: 1200, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal memperbarui data', text: err?.response?.data?.detail || 'Terjadi kesalahan' })
    } finally {
      setSavingKabid(false)
    }
  }

  useEffect(() => { loadData() }, [loadData])

  const handlePrint = () => {
    window.print()
  }

  // Hooks must run before conditional returns to keep the hook order stable.
  const uniqueDates = useMemo(() => {
    if (!reportData?.entries) return []
    const dates = [...new Set(reportData.entries.map((e) => e.tanggal))]
    return dates.sort()
  }, [reportData])

  const filteredEntries = useMemo(() => {
    if (!reportData?.entries) return []
    if (!filterTanggal) return reportData.entries
    return reportData.entries.filter((e) => e.tanggal === filterTanggal)
  }, [reportData, filterTanggal])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-700" />
      </div>
    )
  }

  if (!periode || !reportData) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="border border-rose-200 bg-rose-50 rounded p-5">
          <div className="font-semibold text-rose-900">Laporan Tidak Ditemukan</div>
          <p className="text-sm text-rose-800 mt-1">
            Data laporan kinerja untuk pegawai dengan NIP {nip} tidak ditemukan.
          </p>
        </div>
      </div>
    )
  }

  const tanggalSekarang = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* CSS Khusus Cetak & Tampilan A4 */}
      <style>{`
        /* Tampilan Layar (Screen Look) - Mirip Kertas A4 */
        .print-area {
          width: 100%;
          max-width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          margin: 2rem auto;
          box-sizing: border-box;
        }

        @media (min-width: 768px) {
          .print-area {
            padding: 20mm;
          }
        }

        /* Tampilan Cetak (Print Look) */
        @media print {
          /* Hilangkan elemen navigasi admin & layout sidebar */
          aside, header, nav, footer, .no-print, button, .btn {
            display: none !important;
          }
          /* Reset margin kontainer utama */
          body, main, .min-h-screen {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 2cm;
          }
          /* Rapikan tabel cetak */
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header Halaman (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print border-b border-slate-200 pb-4">
        <div>
          <button
            onClick={() => navigate(isAdmin ? `/panel/kinerja/${id}/laporan` : `/panel/kinerja/${id}`)}
            className="btn text-ink-500 hover:text-ink-900 !px-0 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke {isAdmin ? 'Rekap Laporan' : 'Kinerja'}
          </button>
          <h1 className="section-title">Laporan Kinerja Individu</h1>
          <p className="text-sm text-ink-500">
            Cetak atau simpan laporan harian kinerja pegawai sebagai berkas fisik/PDF
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <CalendarDays className="w-4 h-4 text-ink-400" />
            <select
              className="text-sm bg-transparent border-none focus:ring-0 text-ink-700 pr-6 cursor-pointer"
              value={filterTanggal}
              onChange={(e) => setFilterTanggal(e.target.value)}
            >
              <option value="">Semua Tanggal</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowNomorNaskah((v) => !v)}
            className={`btn flex items-center gap-1.5 ${showNomorNaskah ? 'bg-brand-100 text-brand-800 hover:bg-brand-200' : 'bg-slate-100 text-ink-800 hover:bg-slate-200'}`}
          >
            {showNomorNaskah ? 'Sembunyikan Nomor Naskah' : 'Tampilkan Nomor Naskah'}
          </button>
          <button
            onClick={() => setShowKabidModal(true)}
            className="btn bg-slate-100 hover:bg-slate-200 text-ink-800 flex items-center gap-1.5"
          >
            <Pencil className="w-4 h-4" /> Atur Penandatanganan
          </button>
          <button onClick={handlePrint} className="btn-primary">
            <Printer className="w-4 h-4" /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* Area Laporan Cetak (Kertas A4 Look) */}
      <div className="print-area space-y-6">
        {/* Kop Laporan */}
        <div className="text-center space-y-1 pb-4 border-b-2 border-double border-slate-900">
          <h2 className="font-bold text-xl uppercase tracking-wide">LAPORAN KINERJA HARIAN PEGAWAI</h2>
          {showNomorNaskah && (
            <div className="text-sm font-mono font-bold mt-1">Nomor: {"${nomor_naskah}"}</div>
          )}
          <h3 className="font-semibold text-md text-ink-700">BIDANG {periode.bidang.toUpperCase()}</h3>
          <p className="text-sm text-ink-500">
            Bulan {BULAN[periode.bulan]} Tahun {periode.tahun}
          </p>
        </div>

        {/* Info Pegawai */}
        <div className="text-sm pt-2">
          <table className="w-full max-w-2xl border-none text-left">
            <tbody>
              <tr className="border-none">
                <td className="w-28 py-1 font-medium text-ink-600 border-none">Nama Pegawai</td>
                <td className="w-4 py-1 text-ink-950 border-none">:</td>
                <td className="py-1 font-semibold text-ink-950 border-none">{reportData.nama_pegawai}</td>
              </tr>
              <tr className="border-none">
                <td className="w-28 py-1 font-medium text-ink-600 border-none">NIP Pegawai</td>
                <td className="w-4 py-1 text-ink-950 border-none">:</td>
                <td className="py-1 font-mono font-semibold text-ink-950 border-none">{reportData.nip_pegawai || '-'}</td>
              </tr>
              <tr className="border-none">
                <td className="w-28 py-1 font-medium text-ink-600 border-none">Jabatan</td>
                <td className="w-4 py-1 text-ink-950 border-none">:</td>
                <td className="py-1 font-medium text-ink-950 border-none">{reportData.entries?.[0]?.jabatan_pegawai || reportData.entries?.[0]?.pegawai_detail?.jabatan || '-'}</td>
              </tr>
              <tr className="border-none">
                <td className="w-28 py-1 font-medium text-ink-600 border-none">Instansi</td>
                <td className="w-4 py-1 text-ink-950 border-none">:</td>
                <td className="py-1 font-medium text-ink-950 border-none">{reportData.entries?.[0]?.instansi_pegawai || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabel Kinerja */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-900">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-900 p-2 text-center w-8">No</th>
                <th className="border border-slate-900 p-2 text-left w-24">Tanggal</th>
                <th className="border border-slate-900 p-2 text-left">Uraian Kegiatan</th>
                <th className="border border-slate-900 p-2 text-left w-48">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e, idx) => (
                <tr key={e.id}>
                  <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                  <td className="border border-slate-900 p-2 whitespace-nowrap">
                    {new Date(e.tanggal).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="border border-slate-900 p-2">{e.uraian_kegiatan}</td>
                  <td className="border border-slate-900 p-2">{e.keterangan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tanda Tangan / Legalisasi Laporan */}
        {(showKabidTtd || showPegawaiTtd) && (
          <div className="pt-12 text-sm">
            <div className="flex justify-between items-start text-center">
              {/* Tanda Tangan Atasan / Kepala Bidang */}
              {showKabidTtd ? (
                <div>
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala Bidang {periode.bidang}</p>
                  </div>
                  <div>
                    <br />
                    <br />
                    <br />
                    <p className="font-mono font-bold">{"${ttd_pengirim2}"}</p>
                    <br />
                    <br />
                    <br />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold underline">{periode.kepala_bidang_nama || '___________________________'}</p>
                    <p className="text-xs text-ink-500">
                      NIP. {periode.kepala_bidang_nip || '.....................................'}
                    </p>
                  </div>
                </div>
              ) : <div />}

              {/* Tanda Tangan Pegawai Yang Melaporkan */}
              {showPegawaiTtd ? (
                <div>
                  <div>
                    <p>Giri Menang, {tanggalSekarang}</p>
                    <p className="font-semibold">Pegawai Yang Melaporkan</p>
                  </div>
                  <div>
                    <br />
                    <br />
                    <br />
                    <p className="font-mono font-bold">{"${ttd_pengirim1}"}</p>
                    <br />
                    <br />
                    <br />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold underline">{reportData.nama_pegawai}</p>
                    <p className="text-xs text-ink-500 font-mono">NIP. {reportData.nip_pegawai || '.....................................'}</p>
                  </div>
                </div>
              ) : <div />}
            </div>
          </div>
        )}
      </div>

      {/* Modal Edit Kepala Bidang (no-print) */}
      {showKabidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 no-print" onClick={() => setShowKabidModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-ink-900">Atur Penandatanganan</h3>
              <button onClick={() => setShowKabidModal(false)} className="text-ink-500 hover:text-ink-900 text-lg font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveKabid} className="p-5 space-y-4">
              <div>
                <label className="label">Nama Kepala Bidang (Atasan)</label>
                <input
                  className="input"
                  placeholder="e.g. Nama Atasan, M.Kom"
                  value={kabidNama}
                  onChange={(e) => setKabidNama(e.target.value)}
                />
              </div>
              <div>
                <label className="label">NIP Kepala Bidang (Atasan)</label>
                <input
                  className="input"
                  placeholder="e.g. 19801231..."
                  value={kabidNip}
                  onChange={(e) => setKabidNip(e.target.value)}
                />
              </div>
              <div className="space-y-2 pt-1">
                <label className="label">Tampilkan Kolom Tanda Tangan:</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPegawaiTtd}
                      onChange={(e) => setShowPegawaiTtd(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    Pegawai Yang Melaporkan (TTD 1 / {"${ttd_pengirim1}"})
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showKabidTtd}
                      onChange={(e) => setShowKabidTtd(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    Kepala Bidang (TTD 2 / {"${ttd_pengirim2}"})
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowKabidModal(false)} className="btn-outline flex-1">
                  Batal
                </button>
                <button type="submit" disabled={savingKabid} className="btn-primary flex-1">
                  {savingKabid ? 'Menyimpan...' : 'Simpan Detail Atasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
