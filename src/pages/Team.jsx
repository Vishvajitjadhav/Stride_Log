import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePeople } from '../hooks/usePeople'
import { useTeams, useHolidays } from '../hooks/useOrg'
import { useDayFacts, useFacts } from '../hooks/useAnalytics'
import {
  todayISO, addDaysISO, weekStartISO, daysBetween, isWorkingDay, formatLong, formatRange,
} from '../utils/dates'
import { ROLE_LABELS } from '../lib/permissions'
import { STATUS_LABELS } from '../lib/labels'
import TaskEditor from '../components/tasks/TaskEditor'
import ReportButton from '../components/reports/ReportButton'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Tooltip from '../components/ui/Tooltip'

const STATUS_DOT = {
  done: 'bg-emerald-600',
  in_progress: 'bg-amber-500',
  blocked: 'bg-red-600',
  pending: 'bg-gray-300',
}

function dayKind(date, holidays) {
  if (holidays?.byDate?.[date]) return 'holiday'
  return isWorkingDay(date, holidays?.set) ? 'work' : 'weekend'
}

// ── Summary strip ───────────────────────────────────────────────────────────
function Summary({ items }) {
  return (
    <Card className="grid grid-cols-3 divide-x divide-gray-200">
      {items.map(i => (
        <div key={i.label} className="px-4 py-3 sm:px-5">
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">{i.label}{i.tip && <Tooltip text={i.tip} />}</p>
          <p className="mt-1 text-lg sm:text-xl font-semibold text-gray-900 tabular-nums">
            {i.value}<span className="text-sm font-normal text-gray-500"> {i.of}</span>
          </p>
        </div>
      ))}
    </Card>
  )
}

// ── Day view: who is doing what ─────────────────────────────────────────────
function PersonDay({ person, tasks, log, kind, teamName, onAssign, onOpen }) {
  const done = tasks.filter(t => t.status === 'done').length
  const status = log?.submitted
    ? (kind === 'work' ? <Badge variant="submitted">Submitted</Badge> : <Badge variant="extra">Extra day</Badge>)
    : kind === 'work' ? <Badge variant="missing">Not submitted</Badge> : <Badge variant="off">{kind === 'holiday' ? 'Holiday' : 'Weekend'}</Badge>

  return (
    <Card>
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100">
        <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Avatar person={person} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
            <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[person.role]}{teamName ? `, ${teamName}` : ''}</p>
          </div>
        </button>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {status}
          <span className="text-xs text-gray-500 tabular-nums">{done} of {tasks.length} done</span>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks for this day.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map(t => (
              <li key={t.id} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} title={STATUS_LABELS[t.status]} />
                <span className={`flex-1 min-w-0 ${t.status === 'done' ? 'text-gray-500' : 'text-gray-800'}`}>
                  {t.title}
                  {t.assigned_by && <span className="text-xs text-primary-600"> (assigned)</span>}
                </span>
                <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">{t.category ?? 'Uncategorized'}</span>
                <span className="text-xs font-medium text-gray-600 shrink-0 w-20 text-right">{STATUS_LABELS[t.status]}</span>
              </li>
            ))}
          </ul>
        )}
        {(log?.summary || log?.blockers) && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm">
            {log.summary && <p className="text-gray-700"><span className="font-medium text-gray-900">Summary: </span>{log.summary}</p>}
            {log.blockers && <p className="text-red-800"><span className="font-medium">Blocker: </span>{log.blockers}</p>}
          </div>
        )}
        {onAssign && (
          <button onClick={onAssign} className="mt-3 text-xs font-medium text-primary-700 hover:text-primary-900 inline-flex items-center gap-1">
            <Icon name="plus" size={14} /> Assign a task
          </button>
        )}
      </div>
    </Card>
  )
}

function DayView({ date, people, teamName, holidays, canAssign, onAssign }) {
  const navigate = useNavigate()
  const { data, isLoading } = useDayFacts(date)
  const kind = dayKind(date, holidays)

  const rows = useMemo(() => people.map(p => ({
    person: p,
    tasks: (data?.tasks ?? []).filter(t => t.user_id === p.id),
    log: (data?.logs ?? []).find(l => l.user_id === p.id),
  })).sort((a, b) =>
    // Not submitted first (needs attention), then by name.
    Number(Boolean(a.log?.submitted)) - Number(Boolean(b.log?.submitted)) || a.person.name.localeCompare(b.person.name)
  ), [people, data])

  const submitted = rows.filter(r => r.log?.submitted).length
  const all = rows.flatMap(r => r.tasks)
  const done = all.filter(t => t.status === 'done').length
  const blocked = all.filter(t => t.status === 'blocked').length

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map(i => <Card key={i} className="h-32 animate-pulse" />)}</div>

  return (
    <div className="space-y-4">
      <Summary items={[
        { label: 'Submitted', value: submitted, of: `of ${rows.length}`, tip: 'People who submitted their daily log for this day.' },
        { label: 'Tasks done', value: done, of: `of ${all.length}`, tip: 'Tasks marked done out of all tasks planned for, or finished on, this day.' },
        { label: 'Blocked', value: blocked, of: blocked === 1 ? 'task' : 'tasks', tip: 'Tasks waiting on someone or something. Open the person to help.' },
      ]} />
      {kind !== 'work' && (
        <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-2.5">
          {kind === 'holiday' ? `${holidays.byDate[date]} is a company holiday.` : 'This is a weekend.'} Logging is optional and counts as an extra day.
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {rows.map(r => (
          <PersonDay key={r.person.id} {...r} kind={kind} teamName={teamName[r.person.team_id]}
            onOpen={() => navigate(`/team/${r.person.id}`)}
            onAssign={canAssign ? () => onAssign(r.person.id) : undefined} />
        ))}
      </div>
    </div>
  )
}

// ── Week view: employees × days ─────────────────────────────────────────────
function WeekView({ weekStart, people, holidays, onPickDay }) {
  const navigate = useNavigate()
  const today = todayISO()
  const days = daysBetween(weekStart, addDaysISO(weekStart, 6))
  const { data, isLoading } = useFacts({ from: days[0], to: days[6] })

  const cell = (pid, d) => {
    const tasks = (data?.tasks ?? []).filter(t => t.user_id === pid && t.date === d)
    const log = (data?.logs ?? []).find(l => l.user_id === pid && l.date === d)
    const done = tasks.filter(t => t.status === 'done').length
    const kind = dayKind(d, holidays)
    let state
    if (log?.submitted) state = kind === 'work' ? 'submitted' : 'extra'
    else if (d > today) state = 'future'
    else if (kind !== 'work') state = 'off'
    else if (d < today) state = 'missed'
    else state = 'open'
    return { done, total: tasks.length, state }
  }

  const STYLE = {
    submitted: 'bg-emerald-50 text-emerald-900',
    extra: 'bg-accent-50 text-accent-700',
    missed: 'bg-red-50 text-red-800',
    off: 'bg-gray-50 text-gray-400',
    future: 'text-gray-300',
    open: 'bg-white text-gray-700',
  }
  const LABEL = { submitted: 'Submitted', extra: 'Extra day', missed: 'Not submitted', off: 'Day off', future: 'Upcoming', open: 'In progress' }

  if (isLoading) return <Card className="h-64 animate-pulse" />

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table min-w-[720px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 min-w-[11rem]">Employee</th>
              {days.map(d => (
                <th key={d} className={`text-center ${d === today ? '!text-primary-800' : ''}`}>
                  <button onClick={() => onPickDay(d)} className="hover:underline">
                    {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                  </button>
                </th>
              ))}
              <th className="text-right">
                <span className="inline-flex items-center gap-1">Week <Tooltip align="right" text="Tasks done out of tasks planned for the week, and working days submitted out of working days so far." /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map(p => {
              const cells = days.map(d => ({ d, ...cell(p.id, d) }))
              const done = cells.reduce((n, c) => n + c.done, 0)
              const total = cells.reduce((n, c) => n + c.total, 0)
              const workDays = cells.filter(c => isWorkingDay(c.d, holidays?.set) && c.d <= today)
              const logged = workDays.filter(c => c.state === 'submitted').length
              return (
                <tr key={p.id}>
                  <td className="sticky left-0 z-10 bg-white">
                    <button onClick={() => navigate(`/team/${p.id}`)} className="flex items-center gap-2.5 text-left">
                      <Avatar person={p} size="xs" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[9rem]">{p.name}</span>
                    </button>
                  </td>
                  {cells.map(c => (
                    <td key={c.d} className="!px-1.5 !py-1.5">
                      <button onClick={() => onPickDay(c.d)} title={`${LABEL[c.state]}: ${c.done} of ${c.total} tasks done`}
                        className={`w-full h-11 rounded-md flex flex-col items-center justify-center text-xs tabular-nums ${STYLE[c.state]}`}>
                        {c.total > 0 ? <span className="font-semibold">{c.done}/{c.total}</span> : <span>{c.state === 'off' || c.state === 'future' ? '' : '0'}</span>}
                        {c.state === 'missed' && <span className="text-[10px]">missed</span>}
                        {c.state === 'extra' && <span className="text-[10px]">extra</span>}
                      </button>
                    </td>
                  ))}
                  <td className="text-right whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{done} of {total}</p>
                    <p className="text-xs text-gray-500">{logged} of {workDays.length} days</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
        {[['bg-emerald-50 ring-emerald-200', 'Submitted'], ['bg-red-50 ring-red-200', 'Not submitted'], ['bg-accent-50 ring-accent-100', 'Extra day (weekend or holiday)'], ['bg-gray-50 ring-gray-200', 'Day off']].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><span className={`w-3 h-3 rounded ring-1 ring-inset ${c}`} />{l}</span>
        ))}
        <span>Numbers show tasks done out of tasks planned.</span>
      </div>
    </Card>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Team() {
  const { can } = useAuth()
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'week' ? 'week' : 'day'
  const date = params.get('date') || today
  const set = patch => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (next.get('date') === today) next.delete('date')
    if (next.get('view') === 'day') next.delete('view')
    setParams(next, { replace: true })
  }

  const { data: people = [], isLoading } = usePeople()
  const { data: teams = [] } = useTeams()
  const { data: holidays } = useHolidays()
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('all')
  const [assignTo, setAssignTo] = useState(null)
  const canAssign = can('assignTasks')
  const teamName = Object.fromEntries(teams.map(t => [t.id, t.name]))

  const visible = people.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && (team === 'all' || p.team_id === team))

  const weekStart = weekStartISO(date)
  const step = view === 'week' ? 7 : 1
  const label = view === 'week' ? formatRange(weekStart, addDaysISO(weekStart, 6)) : formatLong(date)
  const isCurrent = view === 'week' ? weekStart === weekStartISO(today) : date === today

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">{view === 'week' ? 'Team week' : isCurrent ? 'Team today' : 'Team on this day'}</h2>
          <p className="page-subtitle">{view === 'week' ? 'What everyone planned and finished each day.' : 'What everyone is working on and how far they have got.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {canAssign && <Link to="/assigned" className="hidden sm:inline text-sm font-medium text-primary-700 hover:text-primary-900 mr-1">Assigned by me</Link>}
          <ReportButton defaultScope="all" label="Download report" />
          {canAssign && <Button onClick={() => setAssignTo('')}><Icon name="plus" size={16} /><span className="hidden sm:inline">Assign task</span></Button>}
        </div>
      </div>

      {/* Date + view controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-white border border-gray-200 rounded-md">
          <button onClick={() => set({ date: addDaysISO(date, -step) })} className="h-9 w-9 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Previous"><Icon name="left" size={18} /></button>
          <span className="px-2 text-sm font-medium text-gray-900 min-w-[11rem] text-center">{label}</span>
          <button onClick={() => set({ date: addDaysISO(date, step) })} className="h-9 w-9 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Next"><Icon name="right" size={18} /></button>
        </div>
        {!isCurrent && <Button variant="outline" size="sm" className="h-9" onClick={() => set({ date: '' })}>{view === 'week' ? 'This week' : 'Today'}</Button>}
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={view === 'day'} onClick={() => set({ view: 'day' })}>Day</button>
          <button aria-pressed={view === 'week'} onClick={() => set({ view: 'week' })}>Week</button>
        </div>
        <div className="flex-1" />
        <input type="search" placeholder="Search employee" value={search} onChange={e => setSearch(e.target.value)} className="field !h-9 !py-0 sm:!w-52" />
        {teams.length > 0 && (
          <select value={team} onChange={e => setTeam(e.target.value)} className="field !h-9 !py-0 sm:!w-40" aria-label="Team">
            <option value="all">All teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? <Card className="h-48 animate-pulse" /> : visible.length === 0 ? (
        <Card className="p-10 text-center text-sm text-gray-500">No employees match your search.</Card>
      ) : view === 'day' ? (
        <DayView date={date} people={visible} teamName={teamName} holidays={holidays} canAssign={canAssign} onAssign={setAssignTo} />
      ) : (
        <WeekView weekStart={weekStart} people={visible} holidays={holidays} onPickDay={d => set({ view: 'day', date: d })} />
      )}

      {assignTo !== null && (
        <TaskEditor key={assignTo || 'any'} open assignTo={assignTo} defaultDate={date >= today ? date : today} onClose={() => setAssignTo(null)} />
      )}
    </div>
  )
}
