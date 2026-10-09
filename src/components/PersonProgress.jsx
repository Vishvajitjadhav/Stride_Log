import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { useDashboard } from '../hooks/useAnalytics'
import { useTaskRange } from '../hooks/useTasks'
import { useWorkLogRange } from '../hooks/useWorkLog'
import { useHolidays } from '../hooks/useOrg'
import { todayISO, addDaysISO, weekStartISO, formatRange } from '../utils/dates'
import KpiCard from './charts/KpiCard'
import { DoneColumns } from './charts/Charts'
import WeekTable from './WeekTable'
import MonthCalendar from './MonthCalendar'
import DayDetail from './DayDetail'
import Card, { Section } from './ui/Card'
import Button from './ui/Button'
import Icon from './ui/Icon'

// Week (day by day) and Month (calendar) views of one person's work.
export default function PersonProgress({ person, actions }) {
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'month' ? 'month' : 'week'
  const weekStart = weekStartISO(params.get('week') || today)
  const weekEnd = addDaysISO(weekStart, 6)
  const isThisWeek = weekStart === weekStartISO(today)
  const set = patch => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  const [month, setMonth] = useState(() => parseISO(weekStart))
  const [day, setDay] = useState(today)

  const filters = useMemo(() => ({ preset: 'custom', from: weekStart, to: weekEnd }), [weekStart, weekEnd])
  const { data } = useDashboard(filters, { self: person })
  const { data: tasks = [] } = useTaskRange({ userId: person.id, from: weekStart, to: weekEnd })
  const { data: logs = [] } = useWorkLogRange(weekStart, weekEnd, person.id)
  const { data: holidays } = useHolidays()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={view === 'week'} onClick={() => set({ view: '' })}>Week</button>
          <button aria-pressed={view === 'month'} onClick={() => set({ view: 'month' })}>Month</button>
        </div>
        {view === 'week' && (
          <>
            <div className="flex items-center bg-surface border border-gray-200 rounded-md">
              <button onClick={() => set({ week: addDaysISO(weekStart, -7) })} className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Previous week"><Icon name="left" size={16} /></button>
              <span className="px-2 text-sm font-medium text-gray-900 min-w-[10rem] text-center">{formatRange(weekStart, weekEnd)}</span>
              <button onClick={() => set({ week: addDaysISO(weekStart, 7) })} className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Next week"><Icon name="right" size={16} /></button>
            </div>
            {!isThisWeek && <Button variant="outline" size="sm" onClick={() => set({ week: '' })}>This week</Button>}
          </>
        )}
        <div className="flex-1" />
        {actions}
      </div>

      {view === 'week' ? (
        <>
          {data ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard metric="done" value={data.current.done} context={`of ${data.current.planned}`} growth={data.growth.done} against="last week" />
              <KpiCard metric="completionRate" value={data.current.completionRate} suffix="%" growth={data.growth.completionRate} against="last week" />
              <KpiCard metric="consistency" value={data.current.loggedDays} context={`of ${data.current.expectedDays} days`} against="last week" />
            </div>
          ) : <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map(i => <Card key={i} className="h-28 animate-pulse" />)}</div>}

          <Section title="Day by day" hint="Every task planned for each day of the week and how it ended." bodyClassName="pt-3">
            <WeekTable weekStart={weekStart} tasks={tasks} logs={logs} holidays={holidays}
              onOpenDay={d => { setDay(d); setMonth(parseISO(d)); set({ view: 'month' }) }} />
          </Section>

          {data && (
            <Section title="Tasks completed each week" hint="Last 8 weeks. Solid bars show tasks done; faded bars show tasks planned but not done.">
              <DoneColumns data={data.trend} height={180} />
            </Section>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="p-5 lg:col-span-3">
            <MonthCalendar userId={person.id} month={month} onMonthChange={setMonth} selected={day} onSelect={setDay}
              startDate={person.created_at?.slice(0, 10)} />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <DayDetail key={`${person.id}-${day}`} userId={person.id} date={day} />
          </Card>
        </div>
      )}
    </div>
  )
}
