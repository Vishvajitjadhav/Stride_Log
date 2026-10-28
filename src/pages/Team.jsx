import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePeople } from '../hooks/usePeople'
import { useHolidays } from '../hooks/useOrg'
import { useProjects, projectsOf } from '../hooks/useProjects'
import { useDayFacts, useFacts } from '../hooks/useAnalytics'
import { useFilters, bySource, activeCount, SOURCES } from '../hooks/useFilters'
import {
  todayISO, addDaysISO, weekStartISO, daysBetween, isWorkingDay, formatLong, formatRange,
} from '../utils/dates'
import { ROLE_LABELS, isTracked } from '../lib/permissions'
import { STATUS_LABELS, statusStyle } from '../lib/status'
import TaskEditor from '../components/tasks/TaskEditor'
import Board from '../components/team/Board'
import FilterBar from '../components/FilterBar'
import RailLayout, { FilterPanel, RailField, RailChoices, RailSearch } from '../components/layout/RailLayout'
import DayDrawer from '../components/DayDrawer'
import ReportButton from '../components/reports/ReportButton'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Tooltip from '../components/ui/Tooltip'
import SharingSwitch from '../components/SharingSwitch'

// Tasks grouped by project, in order of first appearance, with "No project" last.
// A person whose tasks have no project gets a single unnamed group.
function byProject(tasks) {
  const groups = new Map()
  tasks.forEach(t => {
    const key = t.project_id ?? ''
    if (!groups.has(key)) groups.set(key, { id: key, name: t.project, tasks: [] })
    groups.get(key).tasks.push(t)
  })
  return [...groups.values()].sort((a, b) => Number(!a.id) - Number(!b.id))
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
function PersonDay({ person, tasks, log, kind, projectNames, projectColor, onAssign, onOpen, tasksOnly, isMe }) {
  const done = tasks.filter(t => t.status === 'done').length
  const status = tasksOnly ? null : log?.submitted
    ? (kind === 'work' ? <Badge variant="submitted">Active</Badge> : <Badge variant="extra">Extra day</Badge>)
    : kind === 'work' ? <Badge variant="missing">No activity</Badge> : <Badge variant="off">{kind === 'holiday' ? 'Holiday' : 'Weekend'}</Badge>

  return (
    <Card>
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100">
        <button onClick={onOpen} className="group flex items-center gap-3 flex-1 min-w-0 text-left" title="See this day in detail">
          <Avatar person={person} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">{person.name}{isMe && <span className="font-normal text-gray-500"> (you)</span>}</p>
            <p className="text-xs text-gray-500 truncate">{projectNames || ROLE_LABELS[person.role]}</p>
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
          <div className="space-y-3">
            {byProject(tasks).map((g, i, all) => (
              <div key={g.id}>
                {(all.length > 1 || g.id) && (
                  <p className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-gray-500">
                    <span className="w-2 h-2 rounded-[3px]" style={{ background: g.id ? projectColor[g.id] ?? 'var(--chart-done)' : 'var(--color-gray-300)' }} />
                    {g.name ?? 'No project'}
                  </p>
                )}
                <ul className="space-y-2">
                  {g.tasks.map(t => (
                    <li key={t.id} className="flex items-start gap-2.5 text-sm">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusStyle(t.status).dot}`} title={STATUS_LABELS[t.status]} />
                      <span className={`flex-1 min-w-0 ${t.status === 'done' ? 'text-gray-500' : 'text-gray-800'}`}>
                        {t.title}
                        {t.assigned_by && <span className="text-xs text-primary-600"> (assigned)</span>}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">{t.category ?? 'Uncategorized'}</span>
                      <span className="text-xs font-medium text-gray-600 shrink-0 w-20 text-right">{STATUS_LABELS[t.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {!tasksOnly && (log?.summary || log?.blockers) && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm">
            {log.summary && <p className="text-gray-700"><span className="font-medium text-gray-900">Summary: </span>{log.summary}</p>}
            {log.blockers && <p className="text-red-800"><span className="font-medium">Blocker: </span>{log.blockers}</p>}
          </div>
        )}
        {onAssign && (
          <button onClick={onAssign} className="mt-3 text-xs font-medium text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
            <Icon name="plus" size={14} /> Assign a task
          </button>
        )}
      </div>
    </Card>
  )
}

function DayView({ date, people, projects, holidays, canAssign, onAssign, onOpen, tasksOnly, me }) {
  const { data, isLoading } = useDayFacts(date)
  const kind = dayKind(date, holidays)

  const rows = useMemo(() => people.map(p => ({
    person: p,
    tasks: (data?.tasks ?? []).filter(t => t.user_id === p.id),
    log: (data?.logs ?? []).find(l => l.user_id === p.id),
  })).sort((a, b) => tasksOnly
    // Employees: themselves first, then by name.
    ? Number(b.person.id === me) - Number(a.person.id === me) || a.person.name.localeCompare(b.person.name)
    // Managers: no activity first (needs attention), then by name.
    : Number(Boolean(a.log?.submitted)) - Number(Boolean(b.log?.submitted)) || a.person.name.localeCompare(b.person.name)
  ), [people, data, tasksOnly, me])

  const projectColor = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p.color])), [projects])
  const submitted = rows.filter(r => r.log?.submitted).length
  const all = rows.flatMap(r => r.tasks)
  const done = all.filter(t => t.status === 'done').length
  const blocked = all.filter(t => t.status === 'blocked').length

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map(i => <Card key={i} className="h-32 skeleton" />)}</div>

  return (
    <div className="space-y-4">
      <Summary items={[
        tasksOnly
          ? { label: 'Working on it', value: rows.filter(r => r.tasks.length).length, of: `of ${rows.length}`, tip: 'Teammates with at least one task for this day.' }
          : { label: 'Active', value: submitted, of: `of ${rows.length}`, tip: 'People who worked on a task or wrote a note this day. It happens on its own, nobody has to submit.' },
        { label: 'Tasks done', value: done, of: `of ${all.length}`, tip: 'Tasks marked done out of all tasks planned for, or finished on, this day.' },
        { label: 'Blocked', value: blocked, of: blocked === 1 ? 'task' : 'tasks', tip: 'Tasks waiting on someone or something. Open the person to help.' },
      ]} />
      {kind !== 'work' && !tasksOnly && (
        <p className="text-sm text-gray-600 bg-surface border border-gray-200 rounded-lg px-4 py-2.5">
          {kind === 'holiday' ? `${holidays.byDate[date]} is a company holiday.` : 'This is a weekend.'} Logging is optional and counts as an extra day.
        </p>
      )}
      <div className="grid grid-cols-1 @3xl:grid-cols-2 @7xl:grid-cols-3 gap-3">
        {rows.map(r => (
          <PersonDay key={r.person.id} {...r} kind={kind} tasksOnly={tasksOnly} isMe={r.person.id === me}
            projectNames={projectsOf(projects, r.person.id).map(pr => pr.name).join(', ')} projectColor={projectColor}
            onOpen={() => onOpen(r.person, date)}
            onAssign={canAssign ? () => onAssign(r.person.id) : undefined} />
        ))}
      </div>
    </div>
  )
}

// ── Week view: employees × days ─────────────────────────────────────────────
function WeekView({ weekStart, people, holidays, sources, onPickDay, onOpen }) {
  const today = todayISO()
  const days = daysBetween(weekStart, addDaysISO(weekStart, 6))
  const { data, isLoading } = useFacts({ from: days[0], to: days[6] })

  const cell = (pid, d) => {
    // Meetings first, then open work, then what is done.
    const order = t => (t.source === 'teams' ? 0 : t.status === 'done' ? 2 : 1)
    const tasks = bySource(data?.tasks ?? [], sources).filter(t => t.user_id === pid && t.date === d).sort((a, b) => order(a) - order(b))
    const log = (data?.logs ?? []).find(l => l.user_id === pid && l.date === d)
    const done = tasks.filter(t => t.status === 'done').length
    const kind = dayKind(d, holidays)
    let state
    if (log?.submitted) state = kind === 'work' ? 'submitted' : 'extra'
    else if (d > today) state = 'future'
    else if (kind !== 'work') state = 'off'
    else if (d < today) state = 'missed'
    else state = 'open'
    return { done, total: tasks.length, state, tasks }
  }

  const STYLE = {
    submitted: 'bg-emerald-50 text-emerald-900',
    extra: 'bg-accent-50 text-accent-700',
    missed: 'bg-red-50 text-red-800',
    off: 'bg-gray-50 text-gray-400',
    future: 'text-gray-300',
    open: 'bg-surface text-gray-700',
  }
  const LABEL = { submitted: 'Active', extra: 'Extra day', missed: 'No activity', off: 'Day off', future: 'Upcoming', open: 'In progress' }

  if (isLoading) return <Card className="h-64 skeleton" />

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table min-w-[980px]">
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
                <span className="inline-flex items-center gap-1">Week <Tooltip align="right" text="Tasks done out of tasks planned for the week, and active working days out of working days so far." /></span>
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
                  <td className="sticky left-0 z-10 bg-surface">
                    <Link to={`/team/${p.id}`} className="flex items-center gap-2.5 text-left hover:underline">
                      <Avatar person={p} size="xs" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[9rem]">{p.name}</span>
                    </Link>
                  </td>
                  {cells.map(c => (
                    <td key={c.d} className="!px-1.5 !py-1.5">
                      <button onClick={() => onOpen(p, c.d)} title={`${LABEL[c.state]}: ${c.done} of ${c.total} tasks done. Click to see the day.`}
                        className={`w-full min-h-[4.75rem] rounded-md p-1.5 flex flex-col gap-0.5 text-left text-xs transition-all duration-150 hover:ring-2 hover:ring-primary-300 hover:-translate-y-px hover:shadow-sm ${STYLE[c.state]}`}>
                        <span className="text-[10px] font-semibold tabular-nums">
                          {c.total > 0 ? `${c.done}/${c.total} done` : c.state === 'missed' ? 'No activity' : c.state === 'extra' ? 'Extra day' : ''}
                        </span>
                        {c.tasks.slice(0, 3).map(t => (
                          <span key={t.id} className="flex items-center gap-1 min-w-0 text-[11px] text-gray-700">
                            {t.source === 'teams'
                              ? <Icon name="calendar" size={11} className="shrink-0 text-[#4b53bc]" />
                              : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusStyle(t.status).dot}`} />}
                            <span className={`truncate ${t.status === 'done' && t.source !== 'teams' ? 'line-through text-gray-400' : ''}`}>{t.title}</span>
                          </span>
                        ))}
                        {c.tasks.length > 3 && <span className="text-[10px] text-gray-500">{c.tasks.length - 3} more</span>}
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
        {[['bg-emerald-50 ring-emerald-200', 'Active'], ['bg-red-50 ring-red-200', 'No activity'], ['bg-accent-50 ring-accent-100', 'Extra day (weekend or holiday)'], ['bg-gray-50 ring-gray-200', 'Day off']].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><span className={`w-3 h-3 rounded ring-1 ring-inset ${c}`} />{l}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><Icon name="calendar" size={12} className="text-[#4b53bc]" />Teams meeting</span>
        <span>Dots show task status. Click a day for every task.</span>
      </div>
    </Card>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Team() {
  const { can, userId } = useAuth()
  // Employees get a read only view of tasks (no daily notes, no week grid).
  const full = can('viewTeam')
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const VIEWS = full ? ['day', 'board', 'week'] : ['day', 'board']
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'day'
  const { filters, setFilter } = useFilters('today')
  const [editing, setEditing] = useState(null)
  const date = params.get('date') || today
  const set = patch => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (next.get('date') === today) next.delete('date')
    if (next.get('view') === 'day') next.delete('view')
    setParams(next, { replace: true })
  }

  const { data: people = [], isLoading } = usePeople()
  const { data: projects = [] } = useProjects()
  const { data: holidays } = useHolidays()
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState(null)   // { person, date }
  const [assignTo, setAssignTo] = useState(null)
  const canAssign = can('assignTasks')
  const project = filters.project

  const visible = people.filter(p =>
    isTracked(p) &&
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (project === 'all' || projects.find(pr => pr.id === project)?.members.some(m => m.user_id === p.id)))

  const weekStart = weekStartISO(date)
  const step = view === 'week' ? 7 : 1
  const label = view === 'week' ? formatRange(weekStart, addDaysISO(weekStart, 6)) : formatLong(date)
  const isCurrent = view === 'week' ? weekStart === weekStartISO(today) : date === today
  const active = (view === 'board' ? activeCount(filters) : Number(project !== 'all') + Number(view === 'week' && filters.sources.length < SOURCES.length)) + Number(Boolean(search.trim()))
  const clear = () => { setFilter({ person: 'all', project: 'all', sources: [] }); setSearch('') }
  const VIEW_LOOK = { day: { label: 'People', icon: 'team' }, board: { label: 'Board', icon: 'dashboard' }, week: { label: 'Calendar', icon: 'calendar' } }

  const rail = (
    <FilterPanel active={active} onClear={clear}>
      <RailField label="View">
        <RailChoices label="View" value={view} onChange={v => set({ view: v })} options={VIEWS.map(v => ({ key: v, ...VIEW_LOOK[v] }))} />
      </RailField>
      {view === 'board' ? (
        <FilterBar fieldsOnly filters={filters} setFilter={setFilter} people={people.filter(isTracked)} projects={projects} showPerson={full} />
      ) : (
        <>
          <RailField label={view === 'week' ? 'Week' : 'Day'}>
            <div className="flex items-center rounded-lg bg-surface ring-1 ring-inset ring-gray-200">
              <button onClick={() => set({ date: addDaysISO(date, -step) })} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-l-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors" aria-label="Previous"><Icon name="left" size={17} /></button>
              <span className="flex-1 min-w-0 text-center text-[13px] font-medium text-gray-900 truncate">{label}</span>
              <button onClick={() => set({ date: addDaysISO(date, step) })} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors" aria-label="Next"><Icon name="right" size={17} /></button>
            </div>
            {!isCurrent && (
              <button onClick={() => set({ date: '' })} className="mt-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800">
                Back to {view === 'week' ? 'this week' : 'today'}
              </button>
            )}
          </RailField>
          <FilterBar fieldsOnly filters={filters} setFilter={setFilter} projects={projects} showPeriod={false} showPerson={false} showSources={view === 'week'} />
          <RailField label="Employee"><RailSearch value={search} onChange={setSearch} placeholder="Search employee" label="Search employee" /></RailField>
        </>
      )}
    </FilterPanel>
  )

  return (
    <RailLayout rail={rail} active={active} summary={view === 'board' ? VIEW_LOOK.board.label : label}>
      {/* Title and actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 mr-auto">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{view === 'board' ? (full ? 'Team board' : 'My board') : view === 'week' ? 'Team calendar' : isCurrent ? 'Team today' : 'Team on this day'}</h2>
          <p className="text-xs text-gray-500">
            {view === 'board' ? (full ? 'Where every piece of work stands and who has it.' : 'Where your work stands.')
              : !full ? 'What your teammates are working on. Read only.'
              : view === 'week' ? 'Meetings and tasks for everyone, day by day.' : 'What everyone is working on and how far they have got.'}
          </p>
        </div>
        <SharingSwitch what="tasks" tip="When on, employees get a read only Team page with everyone's tasks. Daily notes and blockers stay private to managers." />
        {canAssign && <Link to="/assigned" className="hidden sm:inline text-sm font-medium text-primary-700 hover:text-primary-800">Assigned by me</Link>}
        {full && <ReportButton defaultScope="all" label="Report" />}
        {canAssign && <Button onClick={() => setAssignTo('')}><Icon name="plus" size={16} /><span className="hidden sm:inline">Assign task</span></Button>}
      </div>

      {/* Phones and tablets: the rail is folded, so the views sit up here too. */}
      <div className="lg:hidden segmented w-full grid" style={{ gridTemplateColumns: `repeat(${VIEWS.length}, minmax(0, 1fr))` }} role="group" aria-label="View">
        {VIEWS.map(v => <button key={v} aria-pressed={view === v} onClick={() => set({ view: v })}>{VIEW_LOOK[v].label}</button>)}
      </div>

      {view === 'board' ? (
        <Board filters={filters} people={people.filter(isTracked)} holidays={holidays} me={userId} full={full}
          onOpen={c => {
            // Jira issues (and Jira work you can't edit) open in Jira.
            if (c.kind === 'issue' || (c.url && !canAssign && c.userId !== userId)) { if (c.url) window.open(c.url, '_blank', 'noopener'); return }
            if (canAssign || c.userId === userId) setEditing(c.task)
            else setDrawer({ person: people.find(p => p.id === c.userId), date: c.task.date })
          }} />
      ) : isLoading ? <Card className="h-48 skeleton" /> : visible.length === 0 ? (
        <Card className="p-10 text-center text-sm text-gray-500">No employees match these filters.</Card>
      ) : view === 'day' ? (
        <DayView date={date} people={visible} projects={projects} holidays={holidays} canAssign={canAssign} onAssign={setAssignTo}
          tasksOnly={!full} me={userId}
          onOpen={(person, d) => setDrawer({ person, date: d })} />
      ) : (
        <WeekView weekStart={weekStart} people={visible} holidays={holidays} sources={filters.sources} onPickDay={d => set({ view: 'day', date: d })}
          onOpen={(person, d) => setDrawer({ person, date: d })} />
      )}

      {drawer && (
        <DayDrawer person={drawer.person} date={drawer.date} tasksOnly={!full}
          onDate={d => setDrawer(x => ({ ...x, date: d }))} onClose={() => setDrawer(null)} />
      )}

      {editing && <TaskEditor key={editing.id} open task={editing} onClose={() => setEditing(null)} />}

      {assignTo !== null && (
        <TaskEditor key={assignTo || 'any'} open assignTo={assignTo} defaultDate={date >= today ? date : today} onClose={() => setAssignTo(null)} />
      )}
    </RailLayout>
  )
}
