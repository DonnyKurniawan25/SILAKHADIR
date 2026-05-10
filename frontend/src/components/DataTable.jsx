import { Search } from 'lucide-react'
import { useState, useMemo } from 'react'

/**
 * DataTable minimalis: search client-side.
 * columns: [{ key, title, render?(row), className? }]
 */
export default function DataTable({
  columns,
  rows,
  searchable = true,
  emptyText = 'Belum ada data',
  initialSearch = '',
  actions,
}) {
  const [q, setQ] = useState(initialSearch)

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
            {filtered.map((row, i) => (
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
    </div>
  )
}
