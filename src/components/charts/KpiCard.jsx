import Card from '../ui/Card'
import Tooltip from '../ui/Tooltip'
import { GLOSSARY } from '../../lib/glossary'

// One headline number: what it is (with tooltip), the value, what it means,
// and how it changed versus the previous period in plain words.
//   metric: key in GLOSSARY       value / suffix: what to show
//   context: e.g. "of 68 planned" growth: { value, prev, delta } from compare()
//   against: the comparison period in words, e.g. 'last week'
//   noPrevious: the comparison period had no data, so don't claim a change
export default function KpiCard({ metric, label, value, suffix = '', context, growth, against = 'the previous period', noPrevious = false, lowerIsBetter = false, tone }) {
  const g = GLOSSARY[metric] ?? {}
  let change = null
  if (growth && noPrevious) {
    change = <p className="text-xs text-gray-500">No data for {against}</p>
  } else if (growth) {
    const d = growth.delta
    const good = lowerIsBetter ? d < 0 : d > 0
    const unit = suffix === '%' ? ' points' : ''
    const text = d === 0 ? `Same as ${against}` : `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)}${unit} vs ${against}`
    const color = d === 0 ? 'text-gray-500' : good ? 'text-emerald-700' : 'text-red-700'
    change = <p className={`text-xs font-medium ${color}`}>{text}</p>
  }

  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-1">
      <p className="text-[13px] font-medium text-gray-600 flex items-center gap-1.5">
        {label ?? g.label}
        {g.tip && <Tooltip text={g.tip} />}
      </p>
      <p className={`text-[28px] leading-9 font-semibold tracking-tight tabular-nums ${tone ?? 'text-gray-900'}`}>
        {value}{suffix && <span className="text-lg font-medium text-gray-400 ml-0.5">{suffix}</span>}
        {context && <span className="text-sm font-normal text-gray-500 ml-2">{context}</span>}
      </p>
      {change}
      {!change && g.short && <p className="text-xs text-gray-500">{g.short}</p>}
    </Card>
  )
}
