import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useDashboard } from '../hooks/useAnalytics'
import { useFilters } from '../hooks/useFilters'
import { formatRange } from '../utils/dates'
import { observations } from '../utils/metrics'
import { GLOSSARY } from '../lib/glossary'
import { ROLE_LABELS } from '../lib/permissions'
import FilterBar from '../components/FilterBar'
import KpiCard from '../components/charts/KpiCard'
import { DoneColumns, HBars } from '../components/charts/Charts'
import LogHeatmap from '../components/charts/LogHeatmap'
import ReportButton from '../components/reports/ReportButton'
import Card, { Section } from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Tooltip from '../components/ui/Tooltip'

const tone = v => (v >= 80 ? 'text-mint-700' : v >= 50 ? 'text-amber-700' : 'text-red-700')
const days = n => `${n} ${n === 1 ? 'day' : 'days'}`

const COLS = [
  { key: 'done', label: 'Tasks done', tip: GLOSSARY.done.tip, render: r => <><b className="font-semibold text-gray-900">{r.done}</b> of {r.planned}</> },
  { key: 'completionRate', label: 'Completion', tip: GLOSSARY.completionRate.tip,
    render: r => (r.planned ? <span className={`font-medium ${tone(r.completionRate)}`}>{r.completionRate}%</span> : <span className="text-gray-400">No tasks</span>) },
  { key: 'consistency', label: 'Daily logs', tip: GLOSSARY.consistency.tip, render: r => <>{r.loggedDays} of {days(r.expectedDays)}</> },
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
                    <Tooltip text={c.tip} align="right" />
                    <button onClick={() => toggle(c.key)} className="hover:text-gray-900">
                      {c.label}{sort.key === c.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer hover:bg-primary-50/40">
                <td className="align-middle">
                  <div className="flex items-center gap-3">
                    <Avatar person={r} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{ROLE_LABELS[r.role]}</p>
                    </div>
                  </div>
                </td>
                {COLS.map(c => <td key={c.key} className="text-right align-middle tabular-nums whitespace-nowrap">{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-gray-100 stagger">
        {sorted.map((r, i) => (
          <li key={r.id} style={{ '--i': Math.min(i, 12) }}>
            <button onClick={() => onOpen(r.id)} className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-gray-50">
              <Avatar person={r} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500 tabular-nums">
                  {r.done} of {r.planned} done, {r.loggedDays} of {r.expectedDays} logs{r.blocked ? `, ${r.blocked} blocked` : ''}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${r.planned ? tone(r.completionRate) : 'text-gray-400'}`}>
                {r.planned ? `${r.completionRate}%` : 'No tasks'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// Week by week (or month by month) table for one employee or project.
function PeriodTable({ rows, size }) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{size === 'month' ? 'Month' : 'Week starting'}</th>
            <th className="text-right">Tasks done</th>
            <th className="text-right">Completion</th>
            <th className="text-right">Daily logs</th>
            <th className="text-right">Blocked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.from}>
              <td className="font-medium text-gray-900">{r.label}</td>
              <td className="text-right tabular-nums"><b className="font-semibold text-gray-900">{r.done}</b> of {r.planned}</td>
              <td className={`text-right tabular-nums ${r.planned ? tone(r.completionRate) : 'text-gray-400'}`}>{r.planned ? `${r.completionRate}%` : 'No tasks'}</td>
              <td className="text-right tabular-nums">{r.expectedDays ? `${r.loggedDays} of ${r.expectedDays}` : 'Not tracked'}</td>
              <td className="text-right tabular-nums">{r.blocked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProjectCard({ p, onOpen }) {
  return (
    <button onClick={onOpen} className="text-left card p-4 card-hover">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full ring-4 ring-gray-100" style={{ background: p.color }} />
        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {p.activePeople} of {p.members} {p.members === 1 ? 'member' : 'members'} worked on it
      </p>
      <div className="flex items-end justify-between mt-3">
        <div>
          <p className="text-xl font-semibold text-gray-900 tabular-nums">{p.done}<span className="text-sm font-normal text-gray-500"> of {p.planned}</span></p>
          <p className="text-xs text-gray-500">tasks done{p.planned ? `, ${p.completionRate}%` : ''}</p>
        </div>
        <div className="w-28 h-10" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={p.trend} barCategoryGap="20%">
              <Bar dataKey="done" fill={p.color || 'var(--chart-done)'} radius={[3, 3, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </button>
  )
}

export default function Reports() {
  const { filters, setFilter } = useFilters('this_week')
  const { data, isLoading, allPeople, projects } = useDashboard(filters)
  const single = data && filters.person !== 'all' && data.persons.length === 1 ? data.persons[0] : null
  const notes = useMemo(() => (data ? observations({
    current: data.current, previous: data.previous, persons: data.persons, categories: data.categories, against: data.against,
  }) : []), [data])
  const total = data?.categories.reduce((n, c) => n + c.count, 0) ?? 0
  const share = (data?.categories ?? []).slice(0, 6).map(c => ({ ...c, pct: total ? Math.round((c.count / total) * 100) : 0 }))
  const size = data?.trend[0]?.size ?? 'week'
  const periodRows = (data?.trend ?? []).filter(r => r.to >= filters.from && r.from <= filters.to)

  const title = single ? single.name : data?.project ? data.project.name : 'Productivity report'
  const subtitle = [
    single && ROLE_LABELS[single.role],
    data?.project && !single && `Project with ${data.project.members.length} ${data.project.members.length === 1 ? 'member' : 'members'}`,
    formatRange(filters.from, filters.to),
  ].filter(Boolean).join(' · ')

  return (
    <div className="max-w-6xl 2xl:max-w-7xl 3xl:max-w-[88rem] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <ReportButton defaultScope="all"
          personId={filters.person !== 'all' ? filters.person : undefined}
          projectId={filters.project !== 'all' ? filters.project : undefined} />
      </div>

      <FilterBar filters={filters} setFilter={setFilter} people={allPeople} projects={projects} />

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Card key={i} className="h-32 skeleton" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger">
            <KpiCard style={{ '--i': 0 }} metric="done" value={data.current.done} context={`of ${data.current.planned}`} growth={data.growth.done} against={data.against} noPrevious={!data.previous.planned} />
            <KpiCard style={{ '--i': 1 }} metric="completionRate" value={data.current.completionRate} suffix="%" growth={data.growth.completionRate} against={data.against} noPrevious={!data.previous.planned} />
            <KpiCard style={{ '--i': 2 }} metric="consistency" value={data.current.consistency} suffix="%" growth={data.growth.consistency} against={data.against} noPrevious={!data.previous.planned}
              context={`${data.current.loggedDays} of ${data.current.expectedDays}`} />
            <KpiCard style={{ '--i': 3 }} metric="blocked" value={data.current.blocked} growth={data.growth.blocked} against={data.against} noPrevious={!data.previous.planned} lowerIsBetter
              tone={data.current.blocked ? 'text-red-700' : undefined} />
          </div>

          <Section title="Key observations" hint="Written from the numbers above.">
            <ul className="space-y-2.5 stagger">
              {notes.map((n, i) => (
                <li key={i} style={{ '--i': i }} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-primary-400 to-mint-400 ring-4 ring-primary-50 shrink-0" />{n}
                </li>
              ))}
            </ul>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Section className="lg:col-span-3" title={`Tasks completed each ${size}`}
              hint={size === 'month' ? 'Solid bars show tasks done; faded bars show tasks planned but not done.' : 'At least the last 8 weeks. Solid bars show tasks done; faded bars show tasks planned but not done.'}>
              <DoneColumns data={data.trend} />
            </Section>
            <Section className="lg:col-span-2" title="Where the work went"
              tip={<Tooltip text="Share of all tasks in this period by category. Shows what effort went into." />}
              hint="Share of tasks by category.">
              {share.length ? <HBars data={share} valueKey="pct" suffix="%" /> : <p className="text-sm text-gray-500">No tasks in this period.</p>}
            </Section>
          </div>

          {data.projects.length > 0 && !data.project && (
            <Section title="Projects" hint="Select a project to see its full report."
              tip={<Tooltip text="For each project: how many members worked on it in this period, tasks done out of planned, and the trend." />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 stagger">
                {data.projects.map((p, i) => <div key={p.id} style={{ '--i': i }} className="grid"><ProjectCard p={p} onOpen={() => setFilter({ project: p.id })} /></div>)}
              </div>
            </Section>
          )}

          {(single || data.project) && (
            <Section title={size === 'month' ? 'Month by month' : 'Week by week'}
              hint={single ? 'Open the day by day view for every task.' : 'How the project progressed over the period.'}
              actions={single && <Link to={`/team/${single.id}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">Day by day view</Link>}
              bodyClassName="pt-3">
              <PeriodTable rows={periodRows} size={size} />
            </Section>
          )}

          <Section title="Daily logs"
            tip={<Tooltip text={GLOSSARY.consistency.tip} />}
            hint="Who submitted their daily log on each working day. Hover a square for the date.">
            <LogHeatmap grid={data.logGrid} holidayNames={data.holidayNames} />
          </Section>

          {!single && (
            <Section title={data.project ? 'Project members' : 'Employees'} hint="Select an employee to see their report." bodyClassName="pt-3">
              {data.persons.length
                ? <EmployeeTable rows={data.persons} onOpen={id => setFilter({ person: id })} />
                : <p className="text-sm text-gray-500 p-5">No employees match this filter.</p>}
            </Section>
          )}
        </>
      )}
    </div>
  )
}
