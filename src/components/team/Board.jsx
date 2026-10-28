import { useMemo, useState } from 'react'
import { useBoard } from '../../hooks/useBoard'
import { bySource } from '../../hooks/useFilters'
import { boardCards, sortCards, COLUMNS, STUCK_DAYS } from '../../utils/board'
import { statusStyle, STATUS_LABELS } from '../../lib/status'
import { formatShort, todayISO } from '../../utils/dates'
import FilterBar from '../FilterBar'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'

const PAGE = 25
const days = n => `${n} ${n === 1 ? 'day' : 'days'}`

function Source({ c }) {
  if (c.source === 'jira') {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap font-medium text-[#0c66e4] dark:text-[#579dff]">
        <span className="w-2 h-2 rotate-45 rounded-[2px] bg-current" aria-hidden="true" />{c.key ?? 'Jira'}
      </span>
    )
  }
  if (c.source === 'teams') return <span className="inline-flex items-center gap-1 font-medium text-[#4b53bc]"><Icon name="calendar" size={12} />Teams</span>
  return null
}

function BoardCard({ c, person, onOpen }) {
  const st = statusStyle(c.status)
  const alert = c.blocked || c.stuck || c.overdue
  const title = c.key && c.title?.startsWith(c.key) ? c.title.slice(c.key.length).trim() : c.title
  const flag = c.blocked ? 'Blocked'
    : c.stuck ? `Stuck ${days(c.changedDays)}`
    : c.overdue ? `Overdue since ${formatShort(c.due)}`
    : c.status === 'done' ? `Done ${c.task?.completed_on ? formatShort(c.task.completed_on) : ''}`.trim()
    : c.changedDays ? `Updated ${days(c.changedDays)} ago` : 'Updated today'

  return (
    <button onClick={() => onOpen(c)}
      className={`w-full text-left rounded-xl border p-3 card-hover ${st.card} ${alert ? 'ring-2 ring-inset ring-red-300 dark:ring-red-200' : ''}`}>
      <div className="flex items-center gap-2 text-[11px] text-gray-500 min-w-0">
        <Source c={c} />
        {c.project && <span className="truncate">{c.project}</span>}
        {c.statusName && c.statusName !== STATUS_LABELS[c.status] && <span className="ml-auto shrink-0">{c.statusName}</span>}
      </div>
      <p className={`text-sm font-medium mt-1 line-clamp-2 ${c.status === 'done' ? 'text-gray-600' : 'text-gray-900'}`}>
        {title || <span className="italic text-gray-400">Untitled task</span>}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 min-w-0">
        {person ? (
          <span className="flex items-center gap-1.5 min-w-0"><Avatar person={person} size="xs" /><span className="text-xs text-gray-700 truncate">{person.name}</span></span>
        ) : c.assigneeName ? (
          <span className="text-xs text-gray-600 truncate" title="This person is not in StrideLog">{c.assigneeName}, not in StrideLog</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <span className="w-5 h-5 rounded-full bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center"><Icon name="user" size={12} /></span>
            Nobody yet
          </span>
        )}
        <span title={c.stuck ? `No change for ${days(c.changedDays)} (working days)` : undefined}
          className={`ml-auto shrink-0 text-[11px] whitespace-nowrap ${alert ? 'font-medium text-red-700' : 'text-gray-500'}`}>{flag}</span>
      </div>
    </button>
  )
}

function Column({ col, cards, peopleById, onOpen }) {
  const [shown, setShown] = useState(PAGE)
  const st = statusStyle(col.key)
  return (
    <div className="snap-start shrink-0 w-[82vw] sm:w-[19rem] lg:w-auto min-w-0 rounded-2xl bg-gray-50/80 border border-gray-200/70 p-2.5">
      <div className="flex items-center gap-2 px-1.5 pb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-900">{col.label}</p>
        <span className="text-xs text-gray-500 tabular-nums">{cards.length}</span>
      </div>
      <div className="space-y-2">
        {cards.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Nothing here</p>}
        {cards.slice(0, shown).map(c => <BoardCard key={c.id} c={c} person={peopleById[c.userId]} onOpen={onOpen} />)}
        {cards.length > shown && (
          <button onClick={() => setShown(n => n + PAGE)} className="w-full text-xs font-medium text-primary-700 hover:text-primary-800 py-2">
            Show {Math.min(PAGE, cards.length - shown)} more
          </button>
        )}
      </div>
    </div>
  )
}

// Status columns for everyone's work (managers) or your own (employees).
//   onOpen(card): open a task or a Jira issue
export default function Board({ filters, setFilter, people, projects, holidays, me, full, onOpen }) {
  const today = todayISO()
  const { data, isLoading } = useBoard({ from: filters.from, to: filters.to, userId: full ? undefined : me, withIssues: full })
  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])

  const cards = useMemo(() => {
    if (!data) return []
    let all = bySource(boardCards({ ...data, from: filters.from, to: filters.to, today, holidays: holidays?.set }), filters.sources)
    if (filters.person !== 'all') all = all.filter(c => c.userId === filters.person)
    if (filters.project !== 'all') all = all.filter(c => c.projectId === filters.project)
    // Managers see the tracked team plus anything nobody owns.
    if (full) all = all.filter(c => !c.userId || peopleById[c.userId])
    return all
  }, [data, filters, today, holidays, full, peopleById])

  const columns = COLUMNS.map(col => {
    const list = cards.filter(c => c.column === col.key)
    return { col, cards: col.key === 'done' ? [...list].sort((a, b) => a.changedDays - b.changedDays) : sortCards(list) }
  })
  const open = cards.filter(c => c.status !== 'done')
  const stats = [
    { label: 'Open', value: open.length, tone: 'bg-surface border-gray-200 text-gray-900', tip: 'Work not done yet: to do, in progress, in review and blocked.' },
    { label: 'Needs attention', value: open.filter(c => c.stuck || c.overdue || c.blocked).length, tone: 'bg-red-50 border-red-200 text-red-700',
      tip: `Blocked, overdue, or no change for ${STUCK_DAYS} working days or more. These cards have a red outline.` },
    ...(full ? [{ label: 'Unassigned', value: open.filter(c => !c.userId && !c.assigneeName).length, tone: 'bg-amber-50 border-amber-200 text-amber-800', tip: 'Jira issues nobody is assigned to yet.' }] : []),
    { label: 'Done', value: cards.length - open.length, tone: 'bg-mint-50 border-mint-200 text-mint-700', tip: 'Finished in the chosen period.' },
  ]

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} setFilter={setFilter} people={people} projects={projects} showPerson={full} />

      {/* Tinted by meaning; a zero stays neutral so colour only shows where it matters. */}
      <div className={`grid ${stats.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2.5`}>
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-2.5 shadow-[var(--shadow-card)] transition-colors duration-300 ${s.value ? s.tone : 'bg-surface border-gray-200 text-gray-900'}`}>
            <p className="text-xs font-medium opacity-75 flex items-center gap-1.5">{s.label}<Tooltip text={s.tip} /></p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">{COLUMNS.map(c => <Card key={c.key} className="h-64 skeleton" />)}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {columns.map(({ col, cards }) => <Column key={col.key} col={col} cards={cards} peopleById={peopleById} onOpen={onOpen} />)}
        </div>
      )}
      <p className="text-xs text-gray-500">
        Blocked work sits in In progress with a red outline. Cards with a red outline need attention. Open work from up to 30 days before the period is included.
      </p>
    </div>
  )
}
