import { daysBetween, addDaysISO, isWorkingDay, todayISO } from '../utils/dates'
import { STATUS_LABELS, statusStyle } from '../lib/status'
import Badge from './ui/Badge'

// Day by day list of one person's tasks for a week: what they did on each day.
// tasks: rows from useTaskRange (with categories), logs: rows from useWorkLogRange
export default function WeekTable({ weekStart, tasks = [], logs = [], holidays, onOpenDay }) {
  const today = todayISO()
  const days = daysBetween(weekStart, addDaysISO(weekStart, 6))

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="w-36">Day</th>
            <th>Task</th>
            <th className="hidden sm:table-cell w-36">Category</th>
            <th className="w-28 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {days.map(d => {
            const dayTasks = tasks.filter(t => t.date === d)
            const log = logs.find(l => l.date === d)
            const working = isWorkingDay(d, holidays?.set)
            const holiday = holidays?.byDate?.[d]
            if (!working && dayTasks.length === 0 && !log?.submitted) return null
            const state = log?.submitted
              ? <Badge variant={working ? 'submitted' : 'extra'}>{working ? 'Submitted' : 'Extra day'}</Badge>
              : d > today ? <Badge variant="off">Upcoming</Badge>
              : !working ? <Badge variant="off">{holiday ? 'Holiday' : 'Weekend'}</Badge>
              : d === today ? <Badge variant="draft">In progress</Badge>
              : <Badge variant="missing">Not submitted</Badge>
            const rows = dayTasks.length ? dayTasks : [null]
            const notes = [log?.what_i_did && ['Summary', log.what_i_did], log?.blockers && ['Blocker', log.blockers]].filter(Boolean)

            return rows.map((t, i) => (
              <tr key={`${d}-${t?.id ?? 'none'}`} className={i === 0 ? 'border-t-2 border-gray-100' : ''}>
                {i === 0 && (
                  <td rowSpan={rows.length + (notes.length ? 1 : 0)} className="bg-gray-50/60">
                    <button onClick={() => onOpenDay?.(d)} className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                      <p className="text-xs text-gray-500 mb-1.5">{new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </button>
                    {state}
                    {holiday && <p className="text-[11px] text-gray-500 mt-1">{holiday}</p>}
                  </td>
                )}
                {t ? (
                  <>
                    <td className={t.status === 'done' ? 'text-gray-700' : 'text-gray-900'}>
                      {t.title}
                      {t.assigner && <span className="block text-xs text-gray-500">Assigned by {t.assigner.name}</span>}
                      <span className="sm:hidden block text-xs text-gray-500">{t.categories?.name ?? 'Uncategorized'}</span>
                    </td>
                    <td className="hidden sm:table-cell text-gray-600">{t.categories?.name ?? 'Uncategorized'}</td>
                    <td className={`text-right font-medium whitespace-nowrap ${statusStyle(t.status).text}`}>{STATUS_LABELS[t.status]}</td>
                  </>
                ) : (
                  <td colSpan={3} className="text-gray-400">No tasks logged</td>
                )}
              </tr>
            )).concat(notes.length ? [(
              <tr key={`${d}-notes`}>
                <td colSpan={3} className="!pt-1 text-xs text-gray-600">
                  {notes.map(([k, v]) => (
                    <p key={k} className={k === 'Blocker' ? 'text-red-800' : ''}><span className="font-medium">{k}: </span>{v}</p>
                  ))}
                </td>
              </tr>
            )] : [])
          })}
        </tbody>
      </table>
    </div>
  )
}
