import { useMemo, useState } from 'react'
import { useAssignedByMe, useTaskMutations } from '../hooks/useTasks'
import { todayISO } from '../utils/dates'
import TaskItem from '../components/tasks/TaskItem'
import TaskEditor from '../components/tasks/TaskEditor'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

const VIEWS = [
  { key: 'open', label: 'Open' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
]

// Tasks I handed out — follow up on progress, edit or reassign.
export default function Assigned() {
  const [view, setView] = useState('open')
  const { data: tasks = [], isLoading } = useAssignedByMe({ status: view })
  const { update } = useTaskMutations()
  const [editing, setEditing] = useState(null)
  const today = todayISO()

  const groups = useMemo(() => {
    const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today)
    const rest = tasks.filter(t => !overdue.includes(t))
    return [
      { title: 'Overdue', rows: overdue, tone: '!text-red-600' },
      { title: view === 'done' ? 'Completed' : 'Assigned', rows: rest, tone: '' },
    ].filter(g => g.rows.length)
  }, [tasks, today, view])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)} className={`chip ${view === v.key ? 'chip-active' : ''}`}>{v.label}</button>
          ))}
        </div>
        <Button onClick={() => setEditing('new')} className="shrink-0" aria-label="Assign task"><Icon name="plus" size={16} /><span className="hidden sm:inline">Assign task</span></Button>
      </div>

      <Card className="p-4">
        {isLoading ? <div className="h-24 bg-gray-50 rounded-lg animate-pulse" /> : groups.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">No tasks here. Assign one from the Team page or with the button above.</p>
          </div>
        ) : groups.map(g => (
          <div key={g.title} className="mb-2">
            <p className={`section-title mt-2 ${g.tone}`}>{g.title} · {g.rows.length}</p>
            <div className="divide-y divide-gray-50">
              {g.rows.map(t => (
                <TaskItem key={t.id} task={t} showOwner contextDate={t.date}
                  onStatus={(task, status) => update.mutate({ id: task.id, status })}
                  onOpen={setEditing} />
              ))}
            </div>
          </div>
        ))}
      </Card>

      {editing && (
        <TaskEditor key={editing === 'new' ? 'new' : editing.id} open
          task={editing === 'new' ? undefined : editing}
          assignTo={editing === 'new' ? '' : undefined}
          onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
