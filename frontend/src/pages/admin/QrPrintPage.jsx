import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, Loader2 } from 'lucide-react'
import { getEvent, getAttendanceLink } from '../../api/eventApi'
import { useBranding } from '../../context/BrandingContext'

export default function QrPrintPage() {
  const { id } = useParams()
  const { setting } = useBranding()
  const [event, setEvent] = useState(null)
  const [link, setLink] = useState(null)

  useEffect(() => {
    getEvent(id).then((r) => setEvent(r.data))
    getAttendanceLink(id).then((r) => setLink(r.data))
  }, [id])

  if (!event || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-brand-700" />
      </div>
    )
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      {/* Toolbar */}
      <div className="max-w-2xl mx-auto mb-4 flex justify-between items-center px-4 print:hidden">
        <p className="text-sm text-ink-500">Pratinjau lembar QR ukuran A4.</p>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer className="w-4 h-4" /> Cetak
        </button>
      </div>

      {/* Lembar A4 */}
      <div className="max-w-2xl mx-auto bg-white shadow-card print:shadow-none
                      border border-slate-200 print:border-0 rounded print:rounded-none">
        {/* Kop surat gaya resmi */}
        <div className="p-10 pb-6 border-b-2 border-brand-800">
          <div className="flex items-center gap-5">
            {setting?.logo_url && (
              <img src={setting.logo_url} alt="logo" className="w-20 h-20 object-contain flex-shrink-0" />
            )}
            <div className="text-center flex-1">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">
                Pemerintah Daerah
              </div>
              <div className="font-serif font-extrabold text-xl text-ink-900 mt-0.5">
                {setting?.institution_name || 'Instansi Pemerintah'}
              </div>
              {setting?.address && (
                <div className="text-xs text-ink-500 mt-0.5">{setting.address}</div>
              )}
            </div>
          </div>
          <div className="gov-divider mt-5" />
        </div>

        <div className="px-10 py-6">
          {/* Judul */}
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.2em] text-ink-500 font-semibold">
              Daftar Hadir Daring
            </div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-ink-900 mt-1 leading-tight">
              {event.title}
            </h1>
            {event.theme && (
              <p className="text-sm italic text-ink-500 mt-1">{event.theme}</p>
            )}
          </div>

          {/* QR */}
          <div className="flex justify-center mt-7">
            <div className="p-4 bg-white border border-slate-300">
              <img
                src={`${link.qr_image_url}?t=${Date.now()}`}
                alt="QR Code Absensi"
                className="w-[300px] h-[300px] object-contain"
              />
            </div>
          </div>

          {/* Instruksi */}
          <div className="text-center mt-5">
            <div className="inline-block border-y border-brand-800 px-5 py-2">
              <span className="font-serif font-bold text-lg text-brand-800 uppercase tracking-wider">
                Pindai QR untuk Mengisi Daftar Hadir
              </span>
            </div>
            <p className="text-sm text-ink-500 mt-3">
              Buka kamera ponsel dan arahkan ke kode QR di atas, atau kunjungi tautan berikut:
            </p>
            <div className="mt-1 font-mono text-xs text-brand-800 break-all">
              {link.url}
            </div>
          </div>

          {/* Info kegiatan */}
          <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-3 text-sm border-t border-slate-200 pt-5">
            <Info label="Tanggal" value={`${fmtDate(event.start_date)}${event.end_date ? ' s.d. ' + fmtDate(event.end_date) : ''}`} />
            <Info label="Lokasi" value={event.location || '-'} />
            <Info label="Penyelenggara" value={event.organizer || '-'} />
            <Info label="Status" value={event.status_display} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t border-slate-200 text-center text-[11px] text-ink-500">
          Lembar ini dihasilkan oleh {setting?.app_name || 'SILAKHADIR'} —
          Sistem Informasi Layanan Absensi dan Sertifikat Digital.
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-ink-900 mt-0.5">{value}</div>
    </div>
  )
}
