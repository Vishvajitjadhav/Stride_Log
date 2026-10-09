import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePeople } from '../hooks/usePeople'
import { todayISO } from '../utils/dates'
import MonthCalendar from '../components/MonthCalendar'
import DayDetail from '../components/DayDetail'
import Card from '../components/ui/Card'

export default function Calendar() {
  const { profile, can } = useAuth()
  const viewTeam = can('viewTeam')
  const { data: people = [] } = usePeople({ enabled: viewTeam })
  const [personId, setPersonId] = useState(profile?.id)
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(todayISO())
  const person = personId === profile?.id ? profile : people.find(p => p.id === personId)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {viewTeam && (
        <select className="field sm:!w-72" value={personId} onChange={e => setPersonId(e.target.value)} aria-label="Whose calendar">
          <option value={profile.id}>My calendar</option>
          {people.filter(p => p.id !== profile.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-4 lg:col-span-3">
          <MonthCalendar
            userId={personId}
            month={month}
            onMonthChange={m => setMonth(m)}
            selected={selected}
            onSelect={setSelected}
            startDate={person?.created_at?.slice(0, 10)}
          />
        </Card>
        <Card className="p-4 lg:col-span-2">
          {selected && personId && <DayDetail key={`${personId}-${selected}`} userId={personId} date={selected} />}
        </Card>
      </div>
    </div>
  )
}
