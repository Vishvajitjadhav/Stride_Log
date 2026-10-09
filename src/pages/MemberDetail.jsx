import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePerson } from '../hooks/usePeople'
import { useTeams } from '../hooks/useOrg'
import { useDashboard } from '../hooks/useAnalytics'
import { todayISO } from '../utils/dates'
import { ROLE_LABELS } from '../lib/permissions'
import FilterBar, { useFilters } from '../components/FilterBar'
import KpiCard from '../components/charts/KpiCard'
import { DoneColumns, CategoryDonut, PercentLine } from '../components/charts/Charts'
import MonthCalendar from '../components/MonthCalendar'
import DayDetail from '../components/DayDetail'
import ReportButton from '../components/reports/ReportButton'
import TaskEditor from '../components/tasks/TaskEditor'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data: person } = usePerson(id)
  const { data: teams = [] } = useTeams()
  const { filters, setFilter, reset } = useFilters('this_month')
  const { data, isLoading } = useDashboard(filters, { self: person })
  const [tab, setTab] = useState('overview')
  const [month, setMonth] = useState(() => new Date())
  const [day, setDay] = useState(todayISO())
  const [assigning, setAssigning] = useState(false)
  const g = data?.growth

  if (!person) return <div className="h-40 bg-white rounded-xl animate-pulse" />
  const team = teams.find(t => t.id === person.team_id)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 hover:text-gray-700 rounded-lg" aria-label="Back"><Icon name="left" /></button>
        <Avatar person={person} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{person.name}</h2>
          <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[person.role]}{team ? ` · ${team.name}` : ''}{person.email ? ` · ${person.email}` : ''}</p>
        </div>
        {can('assignTasks') && (
          <Button onClick={() => setAssigning(true)} className="shrink-0" aria-label="Assign task"><Icon name="plus" size={16} /><span className="hidden sm:inline">Assign task</span></Button>
        )}
      </div>

      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit">
        {['overview', 'calendar'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'text-gray-600'}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <FilterBar filters={filters} setFilter={setFilter} reset={reset} show={['category', 'status', 'source']}
            categories={data?.categoryOptions ?? []}
            actions={<ReportButton personId={person.id} />} />
          {isLoading || !data ? <Card className="h-40 animate-pulse bg-gray-50" /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Tasks completed" value={data.current.done} growth={g.done} hint={`of ${data.current.planned}`} />
                <KpiCard label="Completion rate" value={data.current.completionRate} suffix="%" growth={g.completionRate} />
                <KpiCard label="Log consistency" value={data.current.consistency} suffix="%" growth={g.consistency}
                  hint={`${data.current.loggedDays}/${data.current.expectedDays} days`} />
                <KpiCard label="Assigned on time" value={data.current.onTimeBase ? data.current.onTimeRate : '–'}
                  suffix={data.current.onTimeBase ? '%' : ''} hint={`${data.current.assigned} assigned`} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Extra days ★" value={data.current.extraDays} accent="text-amber-600" />
                <KpiCard label="Carried over" value={data.current.carried} growth={g.carried} lowerIsBetter />
                <KpiCard label="Blocked" value={data.current.blocked} accent="text-red-600" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-4 lg:col-span-2">
                  <p className="section-title mb-3">Weekly trend — tasks</p>
                  <DoneColumns data={data.trend} />
                </Card>
                <Card className="p-4">
                  <p className="section-title mb-1">Work by category</p>
                  <CategoryDonut data={data.categories} />
                </Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="section-title mb-1">Log consistency by week</p>
                  <PercentLine data={data.trend} dataKey="consistency" name="Consistency" />
                </Card>
                <Card className="p-4">
                  <p className="section-title mb-3">Blockers</p>
                  {data.blockers.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">None in this period.</p> : (
                    <ul className="space-y-2">
                      {data.blockers.map((b, i) => (
                        <li key={i} className="text-sm text-gray-700"><span className="text-xs text-gray-400 mr-2">{b.date.slice(5)}</span>{b.text}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="p-4 lg:col-span-3">
            <MonthCalendar userId={person.id} month={month} onMonthChange={setMonth} selected={day} onSelect={setDay}
              startDate={person.created_at?.slice(0, 10)} />
          </Card>
          <Card className="p-4 lg:col-span-2">
            <DayDetail key={day} userId={person.id} date={day} />
          </Card>
        </div>
      )}

      {assigning && <TaskEditor open assignTo={person.id} onClose={() => setAssigning(false)} />}
    </div>
  )
}
