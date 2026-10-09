import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useAnalytics'
import { formatRange, periodNoun } from '../utils/dates'
import { observations } from '../utils/metrics'
import { GLOSSARY } from '../lib/glossary'
import { ROLE_LABELS } from '../lib/permissions'
import { useFilters } from '../hooks/useFilters'
import PeriodPicker from '../components/PeriodPicker'
import KpiCard from '../components/charts/KpiCard'
import { DoneColumns, HBars } from '../components/charts/Charts'
import ReportButton from '../components/reports/ReportButton'
import Card, { Section } from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Tooltip from '../components/ui/Tooltip'

const tone = v => (v >= 80 ? 'text-emerald-700' : v >= 50 ? 'text-amber-700' : 'text-red-700')

const COLS = [
  { key: 'done', label: 'Tasks done', tip: GLOSSARY.done.tip, render: r => <><b className="font-semibold text-gray-900">{r.done}</b> of {r.planned}</> },
  { key: 'completionRate', label: 'Completion', tip: GLOSSARY.completionRate.tip, render: r => (r.planned ? <span className={`font-medium ${tone(r.completionRate)}`}>{r.completionRate}%</span> : <span className="text-gray-400">No tasks</span>) },
  { key: 'consistency', label: 'Daily logs', tip: GLOSSARY.consistency.tip, render: r => <>{r.loggedDays} of {r.expectedDays} {r.expectedDays === 1 ? 'day' : 'days'}</> },
  { key: 'blocked', label: 'Blocked', tip: GLOSSARY.blocked.tip, render: r => (r.blocked ? <span className="font-medium text-red-700">{r.blocked}</span> : '0') },
]

function EmployeeTable({ rows, onOpen }) {
  const [sort, setSort] = useState({ key: 'done', dir: -1 })
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir || a.name.localeCompare(b.name)),
    [rows, sort]
  )
  const toggle = key => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))

  return (
    <>
      <div className="hidden md:block">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              {COLS.map(c => (
                <th key={c.key} className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <button onClick={() => toggle(c.key)} className="hover:text-gray-900">
                      {c.label}{sort.key === c.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
                    </button>
                    <Tooltip text={c.tip} align="right" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer hover:bg-gray-50">
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar person={r} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{ROLE_LABELS[r.role]}</p>
                    </div>
                  </div>
                </td>
                {COLS.map(c => <td key={c.key} className="text-right tabular-nums whitespace-nowrap">{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-gray-100">
        {sorted.map(r => (
          <li key={r.id}>
            <button onClick={() => onOpen(r.id)} className="w-full text-left px-4 py-3.5 flex items-center gap-3">
              <Avatar person={r} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500 tabular-nums">
                  {r.done} of {r.planned} done, {r.loggedDays} of {r.expectedDays} logs{r.blocked ? `, ${r.blocked} blocked` : ''}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${r.planned ? tone(r.completionRate) : 'text-gray-400'}`}>{r.planned ? `${r.completionRate}%` : 'No tasks'}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const { filters, setFilter } = useFilters('this_week')
  const { data, isLoading, teams } = useDashboard(filters)
  const noun = periodNoun(filters.preset)
  const notes = useMemo(() => (data ? observations({
    current: data.current, previous: data.previous, persons: data.persons, categories: data.categories, periodName: noun,
  }) : []), [data, noun])
  const total = data?.categories.reduce((n, c) => n + c.count, 0) ?? 0
  const share = (data?.categories ?? []).slice(0, 6).map(c => ({ ...c, pct: total ? Math.round((c.count / total) * 100) : 0 }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Productivity report</h2>
          <p className="page-subtitle">{formatRange(filters.from, filters.to)}</p>
        </div>
        <ReportButton defaultScope="all" label="Download report" />
      </div>

      <PeriodPicker filters={filters} setFilter={setFilter}>
        {teams.length > 0 && (
          <select value={filters.team} onChange={e => setFilter({ team: e.target.value })} className="field !h-8 !py-0 !w-40" aria-label="Team">
            <option value="all">All teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </PeriodPicker>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard metric="done" value={data.current.done} context={`of ${data.current.planned}`} growth={data.growth.done} periodName={noun} />
            <KpiCard metric="completionRate" value={data.current.completionRate} suffix="%" growth={data.growth.completionRate} periodName={noun} />
            <KpiCard metric="consistency" value={data.current.consistency} suffix="%" growth={data.growth.consistency} periodName={noun}
              context={`${data.current.loggedDays} of ${data.current.expectedDays}`} />
            <KpiCard metric="blocked" value={data.current.blocked} growth={data.growth.blocked} periodName={noun} lowerIsBetter
              tone={data.current.blocked ? 'text-red-700' : undefined} />
          </div>

          <Section title="Key observations" hint="Generated from the numbers above.">
            <ul className="space-y-2.5">
              {notes.map((n, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />{n}
                </li>
              ))}
            </ul>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Section className="lg:col-span-3" title="Tasks completed each week" hint="Last 8 weeks. Dark shows done; light shows planned but not done.">
              <DoneColumns data={data.trend} />
            </Section>
            <Section className="lg:col-span-2" title="Where the work went"
              tip={<Tooltip text="Share of all tasks in this period by category. Shows what the team spent its effort on." />}
              hint="Share of tasks by category.">
              {share.length ? <HBars data={share} valueKey="pct" suffix="%" /> : <p className="text-sm text-gray-500">No tasks in this period.</p>}
            </Section>
          </div>

          <Section title="Employees" hint="Select an employee to see their day by day work." bodyClassName="pt-3">
            {data.persons.length
              ? <EmployeeTable rows={data.persons} onOpen={id => navigate(`/team/${id}`)} />
              : <p className="text-sm text-gray-500 p-5">No employees match this filter.</p>}
          </Section>
        </>
      )}
    </div>
  )
}
