import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'

/**
 * DataTable minimalis: search client-side + paginasi.
 * columns: [{ key, title, render?(row), className? }]
 */
export default function DataTable({
  columns,
  rows,
  searchable = true,
  emptyText = 'Belum ada data',
  initialSearch = '',
  actions,
  pagination = true,
  defaultPageSize = 25,
}) {
  const [q, setQ] = useState(initialSearch)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const filtered = useMemo(() => {
    if (!q) return rows
    const lower = q.toLowerCase()
    return rows.filter((r) =>
      columns.some((c) => {
        const raw = c.searchValue ? c.searchValue(r) : r[c.key]
        return String(raw ?? '').toLowerCase().includes(lower)
      }),
    )
  }, [q, rows, columns])

  // Reset ke halaman awal saat filter pencarian berubah
  useEffect(() => {
    setPage(0)
  }, [q])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedRows = pagination
    ? filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : filtered

  const startEntry = total === 0 ? 0 : safePage * pageSize + 1
  const endEntry = Math.min((safePage + 1) * pageSize, total)

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between border-b border-slate-100">
        {searchable && (
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari..."
              className="input pl-9"
            />
          </div>
        )}
        {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
            {pagedRows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && total > 0 && (
        <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 bg-slate-50/50">
          <div>
            Menampilkan <span className="font-semibold text-slate-700">{startEntry}</span> - <span className="font-semibold text-slate-700">{endEntry}</span> dari <span className="font-semibold text-slate-700">{total}</span> data
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(0)
              }}
              className="input !py-1 !px-2 text-xs w-auto bg-white"
            >
              <option value={10}>10 per hal</option>
              <option value={25}>25 per hal</option>
              <option value={50}>50 per hal</option>
              <option value={100}>100 per hal</option>
            </select>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="btn-outline !py-1 !px-2.5 text-xs flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </button>
            <span className="text-xs font-medium text-slate-600 px-1">
              Halaman {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="btn-outline !py-1 !px-2.5 text-xs flex items-center gap-1 disabled:opacity-40"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
