import { useState, useMemo } from 'react'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { useWorkLogRange } from '../hooks/useWorkLog'
import { getDateRange, formatDisplay, todayISO } from '../utils/dates'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const FILTERS = ['daily', 'weekly', 'monthly', 'custom']

function HeatmapCalendar({ logs, month }) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const logMap = Object.fromEntries((logs ?? []).map(l => [l.date, (l.tasks ?? []).length]))

  function intensity(count) {
    if (!count) return 'bg-gray-100'
    if (count <= 2) return 'bg-primary-200'
    if (count <= 5) return 'bg-primary-400'
    return 'bg-primary-600'
  }

  return (
    <div>
      <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">
        {format(month, 'MMMM yyyy')}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 font-medium pb-1">{d}</div>
        ))}
        {Array.from({ length: (start.getDay() + 6) % 7 }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const iso = format(day, 'yyyy-MM-dd')
          return (
            <div
              key={iso}
              title={`${iso}: ${logMap[iso] ?? 0} tasks`}
              className={`aspect-square rounded-sm ${intensity(logMap[iso] ?? 0)}`}
            />
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
        <span>Less</span>
        {['bg-gray-100', 'bg-primary-200', 'bg-primary-400', 'bg-primary-600'].map(c => (
          <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

function LogEntry({ log }) {
  const [open, setOpen] = useState(false)
  const tasks = log.tasks ?? []
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{formatDisplay(log.date)}</span>
          <Badge variant={log.submitted_at ? 'submitted' : 'draft'}>
            {log.submitted_at ? 'Submitted' : 'Draft'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{done}/{tasks.length} done</span>
          <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
          {tasks.length > 0 && (
            <div className="pt-4 space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <Badge variant={t.status}>{t.status.replace('_', ' ')}</Badge>
                  <span className="text-sm text-gray-700">{t.title}</span>
                </div>
              ))}
            </div>
          )}
          {(log.what_i_did || log.blockers || log.tomorrow_plan) && (
            <div className="space-y-3 pt-2">
              {log.what_i_did && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">What I did</p>
                  <p className="text-sm text-gray-600">{log.what_i_did}</p>
                </div>
              )}
              {log.blockers && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Blockers</p>
                  <p className="text-sm text-gray-600">{log.blockers}</p>
                </div>
              )}
              {log.tomorrow_plan && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tomorrow</p>
                  <p className="text-sm text-gray-600">{log.tomorrow_plan}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function History() {
  const today = todayISO()
  const [filter, setFilter] = useState('monthly')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [calMonth, setCalMonth] = useState(new Date())

  const range = useMemo(() => {
    if (filter === 'custom') return { from: customFrom, to: customTo }
    return getDateRange(filter)
  }, [filter, customFrom, customTo])

  const { data: logs = [], isLoading } = useWorkLogRange(range.from, range.to)

  const stats = useMemo(() => {
    const allTasks = logs.flatMap(l => l.tasks ?? [])
    const done = allTasks.filter(t => t.status === 'done').length
    return {
      total: allTasks.length,
      done,
      rate: allTasks.length ? Math.round((done / allTasks.length) * 100) : 0,
      submitted: logs.filter(l => l.submitted_at).length,
    }
  }, [logs])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >
            {f}
          </button>
        ))}
        {filter === 'custom' && (
          <div className="flex items-center gap-2 mt-1">
            <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={customTo} min={customFrom} max={today} onChange={e => setCustomTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: stats + heatmap */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            {[['Total tasks', stats.total], ['Completion rate', `${stats.rate}%`], ['Days logged', stats.submitted]].map(([label, val]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-sm font-bold text-primary-600">{val}</span>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="text-gray-400 hover:text-gray-600 text-sm">◀</button>
              <button onClick={() => setCalMonth(new Date())} className="text-xs text-primary-600 hover:underline">Today</button>
              <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="text-gray-400 hover:text-gray-600 text-sm">▶</button>
            </div>
            <HeatmapCalendar logs={logs} month={calMonth} />
          </Card>
        </div>

        {/* Right: entry list */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-16 animate-pulse bg-gray-50" />
          ))}
          {!isLoading && logs.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-gray-400">No entries in this range.</p>
            </div>
          )}
          {logs.map(log => <LogEntry key={log.id} log={log} />)}
        </div>
      </div>
    </div>
  )
}
