import { useId } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// Chart conventions (see dataviz guidance): one y-axis per chart, thin marks
// with rounded data-ends, hairline solid grid, legend for ≥2 series, text in
// gray ink (never series colour), hover tooltip on every chart.
const C = {
  done: 'var(--chart-done)',
  done2: 'var(--chart-done-2)',
  open: 'var(--chart-open)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
}

const tooltipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 12, border: '1px solid var(--color-gray-200)', background: 'var(--color-surface)', boxShadow: '0 12px 32px -12px rgba(20,26,41,0.25)', padding: '8px 12px' },
  labelStyle: { color: 'var(--color-gray-900)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-gray-700)' },
  cursor: { fill: 'rgba(99,102,241,0.07)', radius: 6 },
}
const axisProps = { tick: { fontSize: 11, fill: C.axis }, axisLine: false, tickLine: false }

function Legendish({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  )
}

// Stacked done / not done columns, per week or per day. Bars grow in on load.
export function DoneColumns({ data, xKey = 'label', height = 220, xFormatter }) {
  const id = useId().replace(/:/g, '')
  const rows = data.map(d => ({ ...d, open: Math.max(0, d.planned - d.done) }))
  return (
    <div>
      <Legendish items={[{ label: 'Done', color: C.done }, { label: 'Not done', color: C.open }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 12, right: 4, left: -16, bottom: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id={`done-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={C.done2} />
              <stop offset="1" stopColor={C.done} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} interval="preserveStartEnd" minTickGap={8} />
          <YAxis allowDecimals={false} {...axisProps} width={40} />
          <Tooltip {...tooltipStyle} labelFormatter={xFormatter}
            formatter={(v, name) => [v, name === 'done' ? 'Done' : 'Not done']} />
          <Bar dataKey="done" stackId="a" fill={`url(#done-${id})`} maxBarSize={26} stroke="var(--color-surface)" strokeWidth={2}
            animationDuration={900} animationEasing="ease-out" />
          <Bar dataKey="open" stackId="a" fill={C.open} maxBarSize={26} radius={[6, 6, 0, 0]} stroke="var(--color-surface)" strokeWidth={2}
            animationDuration={900} animationBegin={150} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Horizontal bars (e.g. share of tasks per category), single series, value at
// tip. Each bar sweeps in after the one above it.
export function HBars({ data, valueKey, labelKey = 'name', suffix = '' }) {
  const max = Math.max(1, ...data.map(d => d[valueKey]))
  return (
    <div className="space-y-3 stagger">
      {data.map((d, i) => (
        <div key={d[labelKey]} style={{ '--i': i }} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3" title={`${d[labelKey]}: ${d[valueKey]}${suffix}`}>
          <span className="text-xs text-gray-600 truncate">{d[labelKey]}</span>
          <div className="flex items-center gap-2">
            <div className="h-2.5 rounded-full bg-gradient-to-r from-primary-500 to-mint-400 grow-x"
              style={{ width: `${(d[valueKey] / max) * 100}%`, minWidth: 4, animationDelay: `${i * 70 + 100}ms` }} />
            <span className="text-xs font-semibold text-gray-700 tabular-nums">{d[valueKey]}{suffix}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
