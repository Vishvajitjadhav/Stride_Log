import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, getDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useWorkLogRange } from '../hooks/useWorkLog'
import { useHolidays } from '../hooks/useOrg'
import { toISO, daysBetween, isWorkingDay, todayISO } from '../utils/dates'
import Icon from './ui/Icon'

function useDueInMonth(userId, from, to) {
  return useQuery({
    queryKey: ['tasks', 'due', userId, from, to],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks').select('id, title, status, due_date, date')
        .eq('user_id', userId).gte('due_date', from).lte('due_date', to)
      if (error) throw error
      return data
    },
  })
}

// Per-day state used for colouring.
function dayState({ date, log, holidays, today, startDate }) {
  const working = isWorkingDay(date, holidays)
  const submitted = Boolean(log?.submitted_at)
  if (date > today) return holidays.has(date) ? 'holiday' : 'future'
  if (submitted && !working) return 'extra'
  if (submitted) return 'submitted'
  if (holidays.has(date)) return 'holiday'
  if (!working) return 'weekend'
  if (startDate && date < startDate) return 'none'
  if (log && (log.tasks?.length ?? 0) > 0) return 'partial'
  return date === today ? 'today' : 'missed'
}

const STYLES = {
  submitted: 'bg-primary-600 text-white',
  extra: 'bg-amber-400 text-white',
  partial: 'bg-primary-100 text-primary-800',
  missed: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
  holiday: 'bg-sky-50 text-sky-700',
  weekend: 'bg-gray-50 text-gray-400',
  future: 'text-gray-700',
  today: 'text-gray-900',
  none: 'text-gray-400',
}

const LEGEND = [
  ['submitted', 'Submitted'], ['partial', 'Started, not submitted'], ['missed', 'Missed'],
  ['extra', 'Extra day ★'], ['holiday', 'Holiday'], ['weekend', 'Weekend'],
]

export default function MonthCalendar({ userId, month, onMonthChange, selected, onSelect, startDate }) {
  const today = todayISO()
  const from = toISO(startOfMonth(month))
  const to = toISO(endOfMonth(month))
  const { data: logs = [], isLoading } = useWorkLogRange(from, to, userId)
  const { data: due = [] } = useDueInMonth(userId, from, to)
  const { data: holidays } = useHolidays()
  const hSet = useMemo(() => holidays?.set ?? new Set(), [holidays])

  const logByDate = useMemo(() => Object.fromEntries(logs.map(l => [l.date, l])), [logs])
  const dueByDate = useMemo(() => {
    const m = {}
    due.forEach(t => { (m[t.due_date] ??= []).push(t) })
    return m
  }, [due])
  const days = daysBetween(from, to)
  const lead = (getDay(startOfMonth(month)) + 6) % 7

  const counts = useMemo(() => {
    const c = { submitted: 0, missed: 0, extra: 0 }
    days.forEach(d => {
      const st = dayState({ date: d, log: logByDate[d], holidays: hSet, today, startDate })
      if (st in c) c[st]++
    })
    return c
  }, [days, logByDate, hSet, today, startDate])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonthChange(subMonths(month, 1))} className="p-2 rounded-lg hover:bg-gray-50 text-gray-500" aria-label="Previous month"><Icon name="left" /></button>
        <div className="text-center">
          <p className="font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</p>
          <p className="text-[11px] text-gray-400">{isLoading ? 'Loading…' : `${counts.submitted} submitted · ${counts.missed} missed · ${counts.extra} extra ★`}</p>
        </div>
        <button onClick={() => onMonthChange(addMonths(month, 1))} className="p-2 rounded-lg hover:bg-gray-50 text-gray-500" aria-label="Next month"><Icon name="right" /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-center text-[10px] sm:text-xs text-gray-400 font-medium pb-1">{d}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(d => {
          const log = logByDate[d]
          // Neutral while loading so days don't flash "missed".
          const st = isLoading ? 'future' : dayState({ date: d, log, holidays: hSet, today, startDate })
          const tasks = log?.tasks ?? []
          const doneN = tasks.filter(t => t.status === 'done').length
          const dueHere = dueByDate[d] ?? []
          const overdue = dueHere.some(t => t.status !== 'done' && d < today)
          return (
            <button
              key={d}
              onClick={() => onSelect?.(d)}
              title={holidays?.byDate?.[d] ?? ''}
              className={`relative aspect-square sm:aspect-[4/3] rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm font-medium
                ${STYLES[st]} ${isLoading ? 'animate-pulse' : ''} ${selected === d ? 'ring-2 ring-offset-1 ring-primary-500' : ''} ${d === today ? 'outline outline-2 outline-primary-400' : ''}`}
            >
              <span>{Number(d.slice(8))}{st === 'extra' && '★'}</span>
              {tasks.length > 0 && <span className="hidden sm:block text-[10px] opacity-80">{doneN}/{tasks.length}</span>}
              {dueHere.length > 0 && (
                <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${overdue ? 'bg-red-500' : 'bg-sky-500'}`} />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-gray-500">
        {LEGEND.map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded ${STYLES[k]}`} />{l}</span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500" />Task due</span>
      </div>
    </div>
  )
}
