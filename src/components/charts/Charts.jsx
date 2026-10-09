import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// Chart conventions (see dataviz guidance): one y-axis per chart, thin marks
// with rounded data-ends, hairline solid grid, legend for ≥2 series, text in
// gray ink (never series colour), hover tooltip on every chart.
const C = {
  done: 'var(--chart-done)',
  open: 'var(--chart-open)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
}

const tooltipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 6, border: '1px solid var(--color-gray-200)', background: 'var(--color-surface)', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' },
  labelStyle: { color: 'var(--color-gray-900)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-gray-700)' },
  cursor: { fill: 'rgba(47,78,126,0.06)' },
}
const axisProps = { tick: { fontSize: 11, fill: C.axis }, axisLine: false, tickLine: false }

function Legendish({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  )
}

// Stacked done / not done columns, per week or per day.
export function DoneColumns({ data, xKey = 'label', height = 200, xFormatter }) {
  const rows = data.map(d => ({ ...d, open: Math.max(0, d.planned - d.done) }))
  return (
    <div>
      <Legendish items={[{ label: 'Done', color: C.done }, { label: 'Not done', color: C.open }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 12, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} interval="preserveStartEnd" minTickGap={8} />
          <YAxis allowDecimals={false} {...axisProps} width={40} />
          <Tooltip {...tooltipStyle} labelFormatter={xFormatter}
            formatter={(v, name) => [v, name === 'done' ? 'Done' : 'Not done']} />
          <Bar dataKey="done" stackId="a" fill={C.done} maxBarSize={24} stroke="var(--color-surface)" strokeWidth={2} />
          <Bar dataKey="open" stackId="a" fill={C.open} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="var(--color-surface)" strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}



// Horizontal bars (e.g. tasks done per team) — single series, value at tip.
export function HBars({ data, valueKey, labelKey = 'name', color = C.done, suffix = '' }) {
  const max = Math.max(1, ...data.map(d => d[valueKey]))
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d[labelKey]} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3" title={`${d[labelKey]}: ${d[valueKey]}${suffix}`}>
          <span className="text-xs text-gray-600 truncate">{d[labelKey]}</span>
          <div className="flex items-center gap-2">
            <div className="h-2.5 rounded-r-[3px]" style={{ width: `${(d[valueKey] / max) * 100}%`, minWidth: 2, background: color }} />
            <span className="text-xs font-semibold text-gray-700 tabular-nums">{d[valueKey]}{suffix}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
