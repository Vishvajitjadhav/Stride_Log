import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ROLE_LABELS } from '../lib/permissions'
import { addDaysISO, formatLong, todayISO } from '../utils/dates'
import DayDetail from './DayDetail'
import Avatar from './ui/Avatar'
import Icon from './ui/Icon'

// Right-hand panel (like Jira's issue panel) with one person's day:
// status, every task, notes. Arrow buttons move day by day.
export default function DayDrawer({ person, date, onDate, onClose, tasksOnly = false }) {
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && !e.target.closest?.('input, textarea, select')) onDate(addDaysISO(date, -1))
      if (e.key === 'ArrowRight' && !e.target.closest?.('input, textarea, select') && date < todayISO()) onDate(addDaysISO(date, 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [date, onDate, onClose])

  if (!person) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 animate-[fade_.15s_ease-out]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={`${person.name}, ${formatLong(date)}`}
        className="relative h-full w-full sm:w-[30rem] bg-surface shadow-2xl border-l border-gray-200 flex flex-col animate-[drawer_.2s_ease-out]">
        <header className="flex items-center gap-3 px-5 h-16 border-b border-gray-200 shrink-0">
          <Avatar person={person} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[person.role]}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Close">
            <Icon name="x" />
          </button>
        </header>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <button onClick={() => onDate(addDaysISO(date, -1))} className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100" aria-label="Previous day">
            <Icon name="left" size={16} />
          </button>
          <p className="text-sm font-medium text-gray-900">{formatLong(date)}</p>
          <button onClick={() => onDate(addDaysISO(date, 1))} disabled={date >= todayISO()} className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="Next day">
            <Icon name="right" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DayDetail key={`${person.id}-${date}`} userId={person.id} date={date} compact tasksOnly={tasksOnly} />
        </div>

        {!tasksOnly && <footer className="px-5 py-3 border-t border-gray-200 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Link to={`/team/${person.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
            Open {person.name.split(' ')[0]}'s full report <Icon name="right" size={14} />
          </Link>
        </footer>}
      </aside>
    </div>,
    document.body
  )
}
