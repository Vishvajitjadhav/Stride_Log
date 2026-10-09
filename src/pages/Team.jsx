import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePeople } from '../hooks/usePeople'
import { useTeams, useHolidays } from '../hooks/useOrg'
import { useFacts } from '../hooks/useAnalytics'
import { todayISO, isWorkingDay } from '../utils/dates'
import { ROLE_LABELS } from '../lib/permissions'
import TaskEditor from '../components/tasks/TaskEditor'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function Team() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const today = todayISO()
  const { data: people = [], isLoading } = usePeople()
  const { data: teams = [] } = useTeams()
  const { data: holidays } = useHolidays()
  const { data: facts } = useFacts({ from: today, to: today })
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('all')
  const [status, setStatus] = useState('all')
  const [assignTo, setAssignTo] = useState(null)

  const working = isWorkingDay(today, holidays?.set)
  const teamName = Object.fromEntries(teams.map(t => [t.id, t.name]))

  const rows = useMemo(() => {
    const tasks = facts?.tasks ?? []
    const logs = facts?.logs ?? []
    return people.map(p => {
      const mine = tasks.filter(t => t.user_id === p.id)
      return {
        ...p,
        submitted: logs.some(l => l.user_id === p.id && l.submitted),
        total: mine.length,
        done: mine.filter(t => t.status === 'done').length,
        blocked: mine.filter(t => t.status === 'blocked').length,
      }
    })
  }, [people, facts])

  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) &&
    (team === 'all' || r.team_id === team) &&
    (status === 'all' || (status === 'submitted' ? r.submitted : !r.submitted))
  )
  const submittedCount = rows.filter(r => r.submitted).length

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">Today's submissions</span>
          <span className="text-sm text-gray-500 tabular-nums">{submittedCount} / {rows.length}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: rows.length ? `${(submittedCount / rows.length) * 100}%` : 0 }} />
        </div>
        {!working && <p className="text-xs text-amber-700 mt-2">Not a working day — submissions today count as extra days ★</p>}
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <input type="search" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} className="field flex-1" />
        <div className="flex gap-2">
          {teams.length > 0 && (
            <select value={team} onChange={e => setTeam(e.target.value)} className="field sm:!w-40" aria-label="Team">
              <option value="all">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <select value={status} onChange={e => setStatus(e.target.value)} className="field sm:!w-36" aria-label="Status">
            <option value="all">Everyone</option>
            <option value="submitted">Submitted</option>
            <option value="missing">Not submitted</option>
          </select>
          {can('assignTasks') && (
            <Button onClick={() => setAssignTo('')} className="shrink-0" aria-label="Assign task"><Icon name="plus" size={16} /><span className="hidden sm:inline">Assign task</span></Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(m => (
            <Card key={m.id} className="p-4 hover:border-primary-300 transition-colors">
              <button onClick={() => navigate(`/team/${m.id}`)} className="w-full text-left">
                <div className="flex items-center gap-3">
                  <Avatar person={m} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {ROLE_LABELS[m.role]}{m.team_id && teamName[m.team_id] ? ` · ${teamName[m.team_id]}` : ''}
                    </p>
                  </div>
                  <Badge variant={m.submitted ? 'submitted' : working ? 'missing' : 'draft'}>
                    {m.submitted ? 'Submitted' : working ? 'Pending' : 'Off'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <span>{m.done}/{m.total} tasks done today</span>
                  {m.blocked > 0 && <span className="text-red-600">{m.blocked} blocked</span>}
                </div>
              </button>
              {can('assignTasks') && (
                <button onClick={() => setAssignTo(m.id)} className="mt-3 text-xs font-medium text-primary-600 flex items-center gap-1">
                  <Icon name="assign" size={14} /> Assign task
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
      {!isLoading && filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No one matches your filters.</p>}

      {assignTo !== null && (
        <TaskEditor key={assignTo || 'any'} open assignTo={assignTo} onClose={() => setAssignTo(null)} />
      )}
    </div>
  )
}
