import { useState } from 'react'
import { filterCertificateParticipants } from '../utils/certificateReview.mjs'

export default function CertificateParticipantSelect({ participants, value, onChange, disabled, label }) {
  const [query, setQuery] = useState('')
  const matches = filterCertificateParticipants(participants, query)
  // Keep the current assignment visible even when the search excludes it.
  const current = participants.find((p) => String(p.id) === String(value))
  const options = current && !matches.some((p) => p.id === current.id) ? [current, ...matches] : matches
  return <div className="min-w-[260px] space-y-1">
    <input type="search" aria-label={`Cari ${label}`} className="input" placeholder="Cari nama, NIK, atau NIP..." value={query} disabled={disabled} onChange={(e) => setQuery(e.target.value)} />
    <select aria-label={label} disabled={disabled} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Lewati — tanpa peserta</option>
      {options.map((p) => <option key={p.id} value={p.id}>{p.full_name} · NIK {p.nik || '-'}{p.nip ? ` · NIP ${p.nip}` : ''}</option>)}
    </select>
    {query && <p role="status" className="text-xs text-ink-500">{matches.length ? `${matches.length} peserta cocok.` : 'Tidak ada peserta cocok. Pilihan saat ini tetap dipertahankan.'}</p>}
  </div>
}
