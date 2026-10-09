import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkLogRange } from '../hooks/useWorkLog'
import { useHolidays } from '../hooks/useOrg'
import { formatShort, isWorkingDay, todayISO } from '../utils/dates'
import FilterBar, { useFilters } from '../components/FilterBar'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { STATUS_LABELS } from '../lib/labels'
import Icon from '../components/ui/Icon'

function LogEntry({ log, working }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const tasks = log.tasks ?? []
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900">{formatShort(log.date)}</span>
          {log.submitted_at
            ? <Badge variant={working ? 'submitted' : 'extra'}>{working ? 'Submitted' : 'Extra ★'}</Badge>
            : <Badge variant="draft">Draft</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-500 tabular-nums">{done}/{tasks.length}</span>
          <Icon name="down" size={16} className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
          {tasks.length > 0 && (
            <ul className="pt-3 space-y-1.5">
              {tasks.map(t => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Badge variant={t.status}>{STATUS_LABELS[t.status]}</Badge>
                  <span className="text-gray-700 flex-1 min-w-0 truncate">{t.title}</span>
                  {t.categories && <span className="text-[11px] shrink-0" style={{ color: t.categories.color }}>{t.categories.name}</span>}
                </li>
              ))}
            </ul>
          )}
          {[['Highlights', log.what_i_did], ['Blockers', log.blockers], ['Plan for tomorrow', log.tomorrow_plan]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{k}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{v}</p>
            </div>
          ))}
          <button onClick={() => navigate(log.date === todayISO() ? '/today' : `/today?date=${log.date}`)} className="text-xs font-medium text-primary-600">
            Open this day →
          </button>
        </div>
      )}
    </Card>
  )
}

export default function History() {
  const { filters, setFilter, reset } = useFilters('this_month')
  const { data: logs = [], isLoading } = useWorkLogRange(filters.from, filters.to)
  const { data: holidays } = useHolidays()

  const stats = useMemo(() => {
    const tasks = logs.flatMap(l => l.tasks ?? [])
    const done = tasks.filter(t => t.status === 'done').length
    return {
      total: tasks.length, done,
      rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      submitted: logs.filter(l => l.submitted_at).length,
    }
  }, [logs])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <FilterBar filters={filters} setFilter={setFilter} reset={reset} />

      <div className="grid grid-cols-4 gap-2">
        {[['Tasks', stats.total], ['Done', stats.done], ['Rate', `${stats.rate}%`], ['Days', stats.submitted]].map(([l, v]) => (
          <Card key={l} className="p-3 text-center">
            <p className="text-lg font-bold text-primary-600 tabular-nums">{v}</p>
            <p className="text-[11px] text-gray-500">{l}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading && [0, 1, 2].map(i => <Card key={i} className="h-14 animate-pulse bg-gray-50" />)}
        {!isLoading && logs.length === 0 && <p className="text-center text-sm text-gray-400 py-12">No entries in this range.</p>}
        {logs.map(log => <LogEntry key={log.id} log={log} working={isWorkingDay(log.date, holidays?.set)} />)}
      </div>
    </div>
  )
}
