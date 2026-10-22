import Card from '../ui/Card'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import { CountUp } from '../ui/Motion'
import { GLOSSARY } from '../../lib/glossary'

// Icon chip colour per metric, so each headline number is easy to spot.
const LOOK = {
  done: { icon: 'check', chip: 'from-[#6c6af0] to-brand' },
  completionRate: { icon: 'progress', chip: 'from-mint-400 to-mint-600' },
  consistency: { icon: 'today', chip: 'from-violet-400 to-violet-600' },
  blocked: { icon: 'block', chip: 'from-rose-400 to-rose-600' },
}

// One headline number: what it is (with tooltip), the value, what it means,
// and how it changed versus the previous period in plain words.
//   metric: key in GLOSSARY       value / suffix: what to show
//   context: e.g. "of 68 planned" growth: { value, prev, delta } from compare()
//   against: the comparison period in words, e.g. 'last week'
//   noPrevious: the comparison period had no data, so don't claim a change
export default function KpiCard({ metric, label, value, suffix = '', context, growth, against = 'the previous period', noPrevious = false, lowerIsBetter = false, tone, style }) {
  const g = GLOSSARY[metric] ?? {}
  const look = LOOK[metric] ?? LOOK.done
  let change = null
  if (growth && noPrevious) {
    change = <p className="text-xs text-gray-500">No data for {against}</p>
  } else if (growth) {
    const d = growth.delta
    const good = lowerIsBetter ? d < 0 : d > 0
    const unit = suffix === '%' ? ' points' : ''
    const text = d === 0 ? `Same as ${against}` : `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)}${unit} vs ${against}`
    const pill = d === 0 ? 'bg-gray-100 text-gray-600' : good ? 'bg-mint-50 text-mint-700' : 'bg-red-50 text-red-700'
    change = (
      <p className={`self-start inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill}`}>
        {d !== 0 && <Icon name="trend" size={12} strokeWidth={2.4} className={d < 0 ? 'scale-y-[-1]' : ''} />}{text}
      </p>
    )
  }

  return (
    <Card className="relative p-4 sm:p-5 flex flex-col gap-1.5" style={style}>
      {/* Soft colour glow in the corner; its own clip box so tooltips are not cut off. */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
        <span className={`absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br ${look.chip} opacity-[.08]`} />
      </span>
      <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${look.chip} text-white flex items-center justify-center shadow-sm`}>
        <Icon name={look.icon} size={16} strokeWidth={2.2} />
      </span>
      <p className="mt-1 text-[13px] font-medium text-gray-600 flex items-center gap-1.5">
        {label ?? g.label}
        {g.tip && <Tooltip text={g.tip} />}
      </p>
      <p className={`text-[28px] sm:text-[32px] leading-10 font-semibold tracking-tight tabular-nums ${tone ?? 'text-gray-900'}`}>
        <CountUp value={value} />{suffix && <span className="text-lg font-medium text-gray-400 ml-0.5">{suffix}</span>}
        {context && <span className="block sm:inline text-sm font-normal text-gray-500 sm:ml-2 leading-5">{context}</span>}
      </p>
      {change}
      {!change && g.short && <p className="text-xs text-gray-500">{g.short}</p>}
    </Card>
  )
}
