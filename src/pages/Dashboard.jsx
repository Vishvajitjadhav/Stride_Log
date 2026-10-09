import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../hooks/useAnalytics'
import { useDayTasks } from '../hooks/useTasks'
import { useWorkLogRange } from '../hooks/useWorkLog'
import { getGreeting, todayISO, formatShort, daysAgoISO } from '../utils/dates'
import { calculateStreak } from '../utils/streak'
import FilterBar, { useFilters } from '../components/FilterBar'
import KpiCard from '../components/charts/KpiCard'
import { DoneColumns, PercentLine, CategoryDonut } from '../components/charts/Charts'
import ReportButton from '../components/reports/ReportButton'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, userId } = useAuth()
  const today = todayISO()
  const { filters, setFilter, reset } = useFilters('this_week')
  const self = useMemo(() => profile, [profile])
  const { data, isLoading } = useDashboard(filters, { self })

  const { data: todayTasks = [] } = useDayTasks(userId, today)
  const { data: recentLogs = [] } = useWorkLogRange(daysAgoISO(60), today)
  const streak = useMemo(
    () => calculateStreak(recentLogs.filter(l => l.submitted_at).map(l => l.date)),
    [recentLogs]
  )
  const submittedToday = recentLogs.some(l => l.date === today && l.submitted_at)
  const upcoming = useMemo(
    () => todayTasks.filter(t => t.status !== 'done' && t.due_date).sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).slice(0, 5),
    [todayTasks]
  )
  const openToday = todayTasks.filter(t => t.status !== 'done').length
  const g = data?.growth

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{getGreeting()}, {profile?.name?.split(' ')[0]} 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {openToday ? `${openToday} open task${openToday > 1 ? 's' : ''} today` : 'Nothing open today'}
            {streak > 0 && <> · 🔥 {streak}-day streak</>}
          </p>
        </div>
        <Button onClick={() => navigate('/today')} variant={submittedToday ? 'outline' : 'primary'} className="shrink-0">
          {submittedToday ? <><Icon name="check" size={16} /> Submitted</> : 'Open My Day'}
        </Button>
      </div>

      <FilterBar filters={filters} setFilter={setFilter} reset={reset}
        actions={<ReportButton defaultScope="me" />} />

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Tasks completed" value={data.current.done} growth={g.done} hint="vs previous period" />
            <KpiCard label="Completion rate" value={data.current.completionRate} suffix="%" growth={g.completionRate}
              hint={`${data.current.done}/${data.current.planned} planned`} />
            <KpiCard label="Log consistency" value={data.current.consistency} suffix="%" growth={g.consistency}
              hint={`${data.current.loggedDays}/${data.current.expectedDays} working days`} />
            <KpiCard label="Assigned on time" value={data.current.onTimeBase ? data.current.onTimeRate : '–'}
              suffix={data.current.onTimeBase ? '%' : ''} growth={data.current.onTimeBase && data.previous.onTimeBase ? g.onTimeRate : undefined}
              hint={`${data.current.assigned} assigned to you`} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-lg font-bold text-amber-600">★ {data.current.extraDays}</p>
              <p className="text-[11px] text-gray-500">Extra days</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{data.current.carried}</p>
              <p className="text-[11px] text-gray-500">Carried over</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-lg font-bold text-red-500">{data.current.blocked}</p>
              <p className="text-[11px] text-gray-500">Blocked</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 lg:col-span-2">
              <p className="section-title mb-3">Weekly trend — tasks</p>
              <DoneColumns data={data.trend} />
            </Card>
            <Card className="p-4">
              <p className="section-title mb-1">Where my effort goes</p>
              <CategoryDonut data={data.categories} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="section-title mb-1">Log consistency by week</p>
              <PercentLine data={data.trend} dataKey="consistency" name="Consistency" />
            </Card>
            <Card className="p-4">
              <p className="section-title mb-3">Coming up</p>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No due dates on your open tasks.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {upcoming.map(t => (
                    <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-800 truncate">{t.title}</span>
                      <span className={`text-xs shrink-0 ${t.due_date < today ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {formatShort(t.due_date)}
                      </span>
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
