import Card from '../ui/Card'

// Headline number with growth vs the previous period.
// lowerIsBetter flips the colour (e.g. carried-over tasks).
export default function KpiCard({ label, value, suffix = '', growth, lowerIsBetter = false, hint, accent }) {
  let delta = null
  if (growth && growth.prev !== undefined) {
    const d = growth.delta
    const good = lowerIsBetter ? d < 0 : d > 0
    const color = d === 0 ? 'text-gray-400' : good ? 'text-green-600' : 'text-red-500'
    const arrow = d > 0 ? '▲' : '▼'
    const amount = suffix === '%' ? `${Math.abs(d)} pts` : Math.abs(d)
    delta = (
      <span className={`text-xs font-medium whitespace-nowrap ${color}`} title={`Previous period: ${growth.prev}${suffix}`}>
        {d === 0 ? 'no change' : `${arrow} ${amount}`}
      </span>
    )
  }

  return (
    <Card className="p-4 flex flex-col">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums mt-1 ${accent ?? 'text-gray-900'}`}>
        {value}{suffix && <span className="text-lg font-bold text-gray-400">{suffix}</span>}
      </p>
      <div className="mt-auto pt-1 flex flex-wrap items-center gap-x-2 min-h-[1.25rem]">
        {delta}
        {hint && <span className="text-[11px] text-gray-400 truncate">{hint}</span>}
      </div>
    </Card>
  )
}
