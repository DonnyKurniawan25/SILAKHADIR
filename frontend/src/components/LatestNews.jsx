import { useEffect, useState } from 'react'
import { ArrowRight, Calendar, ExternalLink, Newspaper } from 'lucide-react'
import { fetchLatestNews } from '../api/newsApi'

export default function LatestNews() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestNews(5)
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="animate-pulse h-32 bg-slate-100 rounded" />
      </section>
    )
  }

  const items = data?.items || []
  // Fallback: tampilkan section dengan link ke website diskominfo walau scraping gagal
  const allUrl = data?.all_url || 'https://diskominfo.lombokbaratkab.go.id/list/berita/terbaru?page=1'

  if (items.length === 0) {
    return (
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6 border-b border-slate-200 pb-3">
            <div>
              <div className="eyebrow flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" /> Berita
              </div>
              <h2 className="section-title mt-1">Berita Terbaru</h2>
              <p className="text-sm text-ink-500 mt-1">
                Informasi terbaru dari Diskominfo Kabupaten Lombok Barat.
              </p>
            </div>
            <a href={allUrl} target="_blank" rel="noreferrer" className="btn-outline">
              Buka Portal Diskominfo <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="border border-slate-200 rounded p-10 text-center text-ink-500 bg-slate-50">
            <Newspaper className="w-10 h-10 mx-auto text-ink-300 mb-2" />
            <p>Belum bisa memuat berita saat ini.</p>
            <p className="text-xs mt-1">Silakan buka portal Diskominfo secara langsung.</p>
          </div>
        </div>
      </section>
    )
  }

  const [hero, ...rest] = items

  return (
    <section className="bg-white border-y border-slate-200 py-14">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6 border-b border-slate-200 pb-3">
          <div>
            <div className="eyebrow flex items-center gap-1.5">
              <Newspaper className="w-3.5 h-3.5" /> Berita
            </div>
            <h2 className="section-title mt-1">Berita Terbaru</h2>
            <p className="text-sm text-ink-500 mt-1">
              Dihimpun dari portal <span className="font-semibold">Diskominfo Kabupaten Lombok Barat</span>.
            </p>
          </div>
          {data?.all_url && (
            <a
              href={data.all_url}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
            >
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* HERO NEWS */}
          <a
            href={hero.url}
            target="_blank"
            rel="noreferrer"
            className="lg:col-span-3 group block border border-slate-200 rounded overflow-hidden bg-white hover:shadow-card-hover transition"
          >
            {hero.image && (
              <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                <img
                  src={hero.image}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              </div>
            )}
            <div className="p-5">
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider font-semibold text-brand-600 mb-2">
                {hero.category && <span>{hero.category}</span>}
                {hero.date_label && (
                  <span className="text-ink-500 font-normal normal-case inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {hero.date_label}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-ink-900 text-xl leading-snug group-hover:text-brand-700">
                {hero.title}
              </h3>
              <div className="mt-3 text-sm text-brand-700 inline-flex items-center gap-1 font-semibold">
                Baca selengkapnya <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          </a>

          {/* DAFTAR BERITA KECIL */}
          <div className="lg:col-span-2 border border-slate-200 rounded bg-white divide-y divide-slate-100">
            {rest.map((n) => (
              <a
                key={n.url}
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="group flex gap-3 p-3 hover:bg-slate-50 transition"
              >
                {n.image && (
                  <div className="w-24 h-20 flex-shrink-0 bg-slate-100 rounded overflow-hidden">
                    <img
                      src={n.image}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-brand-600">
                    {n.category}
                  </div>
                  <div className="font-semibold text-sm text-ink-900 line-clamp-2 group-hover:text-brand-700">
                    {n.title}
                  </div>
                  {n.date_label && (
                    <div className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {n.date_label}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
