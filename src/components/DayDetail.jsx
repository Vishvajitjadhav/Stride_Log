import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDayTasks, useTaskMutations } from '../hooks/useTasks'
import { useWorkLog } from '../hooks/useWorkLog'
import { useHolidays } from '../hooks/useOrg'
import { formatShort, todayISO, isWorkingDay } from '../utils/dates'
import TaskItem from './tasks/TaskItem'
import TaskEditor from './tasks/TaskEditor'
import Badge from './ui/Badge'
import Button from './ui/Button'

// Tasks + notes of one person on one day (calendar side panel, team drawer).
// compact: the date is already shown by the container.
// tasksOnly: an employee looking at a teammate (read only, no daily notes).
export default function DayDetail({ userId, date, compact = false, tasksOnly = false }) {
  const navigate = useNavigate()
  const { userId: me, can } = useAuth()
  const isMe = userId === me
  const editable = isMe || can('assignTasks')
  const { data: tasks = [], isLoading } = useDayTasks(userId, date, { carryOver: false })
  const { data: log } = useWorkLog(date, userId, { enabled: !tasksOnly })
  const { data: holidays } = useHolidays()
  const { update } = useTaskMutations()
  const [editing, setEditing] = useState(null)

  const working = isWorkingDay(date, holidays?.set)
  const holiday = holidays?.byDate?.[date]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          {!compact && <p className="section-title">{formatShort(date)}</p>}
          <p className={compact ? 'text-sm text-gray-600' : 'section-hint'}>
            {holiday ? `Holiday: ${holiday}` : working ? 'Working day' : 'Weekend'}
            {tasks.length > 0 && <>, {tasks.filter(t => t.status === 'done').length} of {tasks.length} tasks done</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tasksOnly ? null : log?.submitted_at ? <Badge variant={working ? 'submitted' : 'extra'}>{working ? 'Submitted' : 'Extra day'}</Badge>
            : <Badge variant="draft">Not submitted</Badge>}
          {isMe && date <= todayISO() && (
            <Button size="sm" variant="outline" onClick={() => navigate(date === todayISO() ? '/today' : `/today?date=${date}`)}>Open</Button>
          )}
          {!isMe && can('assignTasks') && (
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}>Add task</Button>
          )}
        </div>
      </div>

      {isLoading ? <div className="h-16 rounded-lg skeleton" /> : tasks.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No tasks planned for this day.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {tasks.map(t => (
            <TaskItem key={t.id} task={t} contextDate={date} readOnly={!editable}
              onStatus={(task, status) => update.mutate({ id: task.id, status })}
              onOpen={editable ? setEditing : undefined} />
          ))}
        </div>
      )}

      {!tasksOnly && (log?.what_i_did || log?.blockers) && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          {[['Summary', log.what_i_did], ['Blockers', log.blockers]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <p className="text-xs font-medium text-gray-500">{k}</p>
              <p className={`text-sm whitespace-pre-line ${k === 'Blockers' ? 'text-red-700' : 'text-gray-700'}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TaskEditor key={editing === 'new' ? 'new' : editing.id} open
          task={editing === 'new' ? undefined : editing}
          assignTo={editing === 'new' ? userId : undefined}
          defaultDate={date}
          onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
