import { Loader2 } from 'lucide-react'

export default function Loading({ label = 'Memuat...', fullscreen = false }) {
  const base = 'flex items-center justify-center gap-3 text-slate-500'
  if (fullscreen) {
    return (
      <div className={`${base} min-h-screen`}>
        <Loader2 className="w-6 h-6 animate-spin text-brand-700" />
        <span>{label}</span>
      </div>
    )
  }
  return (
    <div className={`${base} py-10`}>
      <Loader2 className="w-5 h-5 animate-spin text-brand-700" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
