export default function DashboardCard({ icon: Icon, label, value, accent = 'brand' }) {
  const palette = {
    brand: 'bg-brand-100 text-brand-800',
    green: 'bg-emerald-100 text-emerald-700',
    gold: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  }
  return (
    <div className="card-hover">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${palette[accent]}`}>
          {Icon && <Icon className="w-6 h-6" />}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="text-3xl font-bold text-slate-800">{value}</div>
        </div>
      </div>
    </div>
  )
}
