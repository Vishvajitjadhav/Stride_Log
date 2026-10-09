import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../hooks/useAnalytics'
import { daysBetween, isWorkingDay, todayISO, formatShort } from '../utils/dates'
import { toCSV, downloadCSV } from '../utils/csv'
import { ROLE_LABELS } from '../lib/permissions'
import FilterBar, { useFilters } from '../components/FilterBar'
import KpiCard from '../components/charts/KpiCard'
import { DoneColumns, PercentLine, CategoryDonut, HBars } from '../components/charts/Charts'
import ReportButton from '../components/reports/ReportButton'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'

const COLUMNS = [
  { key: 'done', label: 'Done', fmt: r => `${r.done}/${r.planned}` },
  { key: 'completionRate', label: 'Completion', fmt: r => `${r.completionRate}%` },
  { key: 'consistency', label: 'Consistency', fmt: r => `${r.consistency}%` },
  { key: 'onTimeRate', label: 'On time', fmt: r => (r.onTimeBase ? `${r.onTimeRate}%` : '–') },
  { key: 'carried', label: 'Carried', fmt: r => r.carried },
  { key: 'blocked', label: 'Blocked', fmt: r => r.blocked },
  { key: 'extraDays', label: 'Extra ★', fmt: r => r.extraDays },
]

function rateTone(v) {
  if (v >= 80) return 'text-green-700'
  if (v >= 50) return 'text-amber-700'
  return 'text-red-600'
}

function PersonTable({ rows, onOpen }) {
  const [sort, setSort] = useState({ key: 'done', dir: -1 })
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir || a.name.localeCompare(b.name)),
    [rows, sort]
  )
  const toggle = key => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="py-2 pl-4 font-medium">Person</th>
              {COLUMNS.map(c => (
                <th key={c.key} className="py-2 px-2 font-medium text-right">
                  <button onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-gray-900">
                    {c.label}{sort.key === c.key && <span>{sort.dir < 0 ? '↓' : '↑'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(r => (
              <tr key={r.id} onClick={() => onOpen(r.id)} className="hover:bg-gray-50 cursor-pointer">
                <td className="py-2.5 pl-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar person={r} size="xs" />
                    <div>
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-[11px] text-gray-400">{ROLE_LABELS[r.role]}</p>
                    </div>
                  </div>
                </td>
                {COLUMNS.map(c => (
                  <td key={c.key} className={`py-2.5 px-2 text-right tabular-nums ${['completionRate', 'consistency'].includes(c.key) ? rateTone(r[c.key]) : 'text-gray-700'}`}>
                    {c.fmt(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <div className="md:hidden divide-y divide-gray-50">
        {sorted.map(r => (
          <button key={r.id} onClick={() => onOpen(r.id)} className="w-full text-left px-4 py-3 flex items-center gap-3">
            <Avatar person={r} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
              <p className="text-xs text-gray-500">
                {r.done}/{r.planned} done · <span className={rateTone(r.consistency)}>{r.consistency}% logged</span>
                {r.blocked > 0 && <span className="text-red-600"> · {r.blocked} blocked</span>}
              </p>
            </div>
            <span className={`text-sm font-bold ${rateTone(r.completionRate)}`}>{r.completionRate}%</span>
          </button>
        ))}
      </div>
    </>
  )
}

// people × days grid: submitted / missed / extra / holiday / weekend
function ComplianceGrid({ people, logs, range, holidays, today }) {
  const days = daysBetween(range.from, range.to)
  if (days.length > 31) return <p className="text-sm text-gray-400">Choose a range of a month or less to see the daily grid.</p>
  const submitted = new Set(logs.filter(l => l.submitted).map(l => `${l.user_id}|${l.date}`))

  const cell = (p, d) => {
    const ok = submitted.has(`${p.id}|${d}`)
    const work = isWorkingDay(d, holidays)
    if (d > today) return { cls: 'bg-gray-50', label: 'Future' }
    if (ok && !work) return { cls: 'bg-amber-400', label: 'Extra day ★' }
    if (ok) return { cls: 'bg-primary-600', label: 'Submitted' }
    if (!work) return { cls: holidays.has(d) ? 'bg-sky-100' : 'bg-gray-100', label: holidays.has(d) ? 'Holiday' : 'Weekend' }
    return { cls: 'bg-red-200', label: 'Missed' }
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th />
            {days.map(d => <th key={d} className="font-normal text-gray-400 px-px pb-1 w-5">{d.slice(8)}</th>)}
          </tr>
        </thead>
        <tbody>
          {people.map(p => (
            <tr key={p.id}>
              <td className="pr-2 text-xs text-gray-600 whitespace-nowrap max-w-[8rem] truncate">{p.name}</td>
              {days.map(d => {
                const c = cell(p, d)
                return <td key={d} className="p-px"><div title={`${p.name} · ${formatShort(d)} · ${c.label}`} className={`w-4 h-4 rounded-[3px] ${c.cls}`} /></td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-gray-500">
        {[['bg-primary-600', 'Submitted'], ['bg-red-200', 'Missed'], ['bg-amber-400', 'Extra day ★'], ['bg-sky-100', 'Holiday'], ['bg-gray-100', 'Weekend']].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${c}`} />{l}</span>
        ))}
      </div>
    </div>
  )
}

export default function Analytics() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const today = todayISO()
  const { filters, setFilter, reset } = useFilters('this_week')
  const { data, isLoading, teams, allPeople } = useDashboard(filters)
  const g = data?.growth
  const shortRange = data && data.daily.length <= 31

  function exportCSV() {
    const byId = Object.fromEntries(allPeople.map(p => [p.id, p.name]))
    const rows = data.rangeTasks.map(t => ({
      date: t.date, person: byId[t.user_id] ?? '', task: t.title, status: t.status,
      category: t.category ?? '', assigned: t.assigned_by ? 'yes' : 'no', due: t.due_date ?? '', completed: t.completed_on ?? '',
    }))
    downloadCSV(`tasks_${filters.from}_to_${filters.to}.csv`, toCSV(rows, [
      { key: 'date', label: 'Date' }, { key: 'person', label: 'Person' }, { key: 'task', label: 'Task' },
      { key: 'status', label: 'Status' }, { key: 'category', label: 'Category' }, { key: 'assigned', label: 'Assigned' },
      { key: 'due', label: 'Due date' }, { key: 'completed', label: 'Completed on' },
    ]))
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <FilterBar
        filters={filters} setFilter={setFilter} reset={reset}
        show={['team', 'person', 'role', 'category', 'status', 'source']}
        teams={teams} people={allPeople} categories={data?.categoryOptions ?? []}
        actions={<>
          <button onClick={exportCSV} disabled={!data} className="chip hidden sm:flex items-center gap-1.5 shrink-0"><Icon name="download" size={14} /> CSV</button>
          <ReportButton defaultScope={can('viewCompany') ? 'company' : 'team'} />
        </>}
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Tasks completed" value={data.current.done} growth={g.done} hint={`of ${data.current.planned} planned`} />
            <KpiCard label="Completion rate" value={data.current.completionRate} suffix="%" growth={g.completionRate} />
            <KpiCard label="Log consistency" value={data.current.consistency} suffix="%" growth={g.consistency}
              hint={`${data.current.loggedDays}/${data.current.expectedDays} person-days`} />
            <KpiCard label="Assigned on time" value={data.current.onTimeBase ? data.current.onTimeRate : '–'}
              suffix={data.current.onTimeBase ? '%' : ''} growth={data.current.onTimeBase && data.previous.onTimeBase ? g.onTimeRate : undefined}
              hint={`${data.current.assigned} assigned`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Active people" value={data.current.activePeople} hint={`of ${data.people.length}`} />
            <KpiCard label="Carried over" value={data.current.carried} growth={g.carried} lowerIsBetter />
            <KpiCard label="Blocked tasks" value={data.current.blocked} growth={g.blocked} lowerIsBetter accent="text-red-600" />
            <KpiCard label="Extra days ★" value={data.current.extraDays} growth={g.extraDays} accent="text-amber-600" hint="weekend / holiday" />
          </div>

          {data.notLoggedToday.length > 0 && isWorkingDay(today, data.holidays) && filters.to >= today && filters.from <= today && (
            <Card className="p-4 border-amber-200 bg-amber-50/50">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                Not submitted today · {data.notLoggedToday.length} of {data.people.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.notLoggedToday.map(p => (
                  <button key={p.id} onClick={() => navigate(`/team/${p.id}`)} className="text-xs bg-white border border-amber-200 rounded-full px-2.5 py-1 text-amber-900">
                    {p.name}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="section-title mb-3">Weekly trend — tasks</p>
              <DoneColumns data={data.trend} />
            </Card>
            <Card className="p-4">
              <p className="section-title mb-1">Log consistency by week</p>
              <PercentLine data={data.trend} dataKey="consistency" name="Consistency" height={200} />
            </Card>
          </div>

          {shortRange && (
            <Card className="p-4">
              <p className="section-title mb-3">Day by day</p>
              <DoneColumns data={data.daily} xKey="date" xFormatter={d => formatShort(d)} height={180} />
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="section-title mb-1">Work by category</p>
              <CategoryDonut data={data.categories} height={260} />
            </Card>
            <Card className="p-4 lg:col-span-2">
              <p className="section-title mb-3">Team comparison — completion rate</p>
              {data.teams.length ? (
                <>
                  <HBars data={data.teams} valueKey="completionRate" suffix="%" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {data.teams.map(t => (
                      <div key={t.name} className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-800 truncate">{t.name}</p>
                        <p className="text-[11px] text-gray-500">{t.members} people · {t.done}/{t.planned} done · {t.consistency}% logged</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-gray-400">Create teams in Settings to compare them.</p>}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">People</p>
              <p className="text-xs text-gray-400">Tap a person for details</p>
            </div>
            {data.persons.length ? <PersonTable rows={data.persons} onOpen={id => navigate(`/team/${id}`)} />
              : <p className="text-sm text-gray-400 p-6 text-center">No one matches these filters.</p>}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="section-title mb-3">Daily log grid</p>
              <ComplianceGrid people={data.people} logs={data.rangeLogs} range={data.range} holidays={data.holidays} today={today} />
            </Card>
            <Card className="p-4">
              <p className="section-title mb-3">Blockers</p>
              {data.blockers.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No blockers raised 🎉</p> : (
                <ul className="space-y-2.5 max-h-80 overflow-y-auto">
                  {data.blockers.map((b, i) => (
                    <li key={i} className="flex gap-3">
                      <Icon name="alert" size={16} className="text-red-500 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800">{b.text}</p>
                        <p className="text-[11px] text-gray-400">{b.name} · {formatShort(b.date)} · {b.kind === 'task' ? 'blocked task' : 'daily note'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
