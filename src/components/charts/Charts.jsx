import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'

// Chart conventions (see dataviz guidance): one y-axis per chart, thin marks
// with rounded data-ends, hairline solid grid, legend for ≥2 series, text in
// gray ink (never series colour), hover tooltip on every chart.
const C = {
  done: '#7c3aed',
  open: '#c4b5fd',
  line: '#7c3aed',
  grid: '#eeecf3',
  axis: '#9ca3af',
}

const tooltipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 10, border: '1px solid #eee', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#374151', fontWeight: 600 },
  itemStyle: { color: '#374151' },
  cursor: { fill: 'rgba(124,58,237,0.06)' },
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

// Stacked done / not-done columns — per week or per day.
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
          <Bar dataKey="done" stackId="a" fill={C.done} maxBarSize={24} stroke="#fff" strokeWidth={2} />
          <Bar dataKey="open" stackId="a" fill={C.open} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Single-series percentage line (e.g. log consistency per week).
export function PercentLine({ data, dataKey, xKey = 'label', height = 140, name }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axisProps} width={44} tickFormatter={v => `${v}%`} />
        <Tooltip {...tooltipStyle} cursor={{ stroke: C.grid, strokeWidth: 1 }} formatter={v => [`${v}%`, name]} />
        <Line type="monotone" dataKey={dataKey} stroke={C.line} strokeWidth={2}
          dot={{ r: 4, fill: C.line, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Category mix — colours come from each category's own setting.
export function CategoryDonut({ data, height = 220 }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-10">No tasks in this period.</p>
  const total = data.reduce((n, d) => n + d.count, 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="45%" outerRadius="75%" innerRadius="50%"
          paddingAngle={1} stroke="#fff" strokeWidth={2}>
          {data.map(c => <Cell key={c.name} fill={c.color} />)}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} tasks (${Math.round((v / total) * 100)}%)`, n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
      </PieChart>
    </ResponsiveContainer>
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
            <div className="h-3 rounded-r-[4px]" style={{ width: `${(d[valueKey] / max) * 100}%`, minWidth: 2, background: color }} />
            <span className="text-xs font-semibold text-gray-700 tabular-nums">{d[valueKey]}{suffix}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
