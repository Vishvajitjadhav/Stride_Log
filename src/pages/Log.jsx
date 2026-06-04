import { useState, useEffect } from 'react'
import { useWorkLog } from '../hooks/useWorkLog'
import { useTasks } from '../hooks/useTasks'
import { useCategories } from '../hooks/useCategories'
import { todayISO } from '../utils/dates'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const STATUS_OPTIONS = [
  { value: 'done',        label: 'Done' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending',     label: 'Pending' },
]

function TaskRow({ task, categories, onUpdate, onDelete, disabled }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <select
        value={task.status}
        disabled={disabled}
        onChange={e => onUpdate({ id: task.id, status: e.target.value })}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white disabled:bg-gray-50"
      >
        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <input
        className="flex-1 text-sm bg-transparent focus:outline-none text-gray-900 placeholder-gray-400 disabled:text-gray-500"
        placeholder="What did you work on?"
        value={task.title}
        disabled={disabled}
        onChange={e => onUpdate({ id: task.id, title: e.target.value })}
      />

      <select
        value={task.category_id ?? ''}
        disabled={disabled}
        onChange={e => onUpdate({ id: task.id, category_id: e.target.value || null })}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white max-w-[120px] disabled:bg-gray-50"
      >
        <option value="">Category</option>
        {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {!disabled && (
        <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-400 text-sm transition-colors">✕</button>
      )}
    </div>
  )
}

export default function Log() {
  const today = todayISO()
  const { data: log, upsert, submit, unsubmit, isLoading: logLoading } = useWorkLog(today)
  const { data: tasks = [], addTask, updateTask, deleteTask } = useTasks(log?.id)
  const { data: categories } = useCategories()

  const [standup, setStandup] = useState({ what_i_did: '', blockers: '', tomorrow_plan: '' })
  const [saving, setSaving] = useState(false)

  const isSubmitted = Boolean(log?.submitted_at)
  const isLocked = isSubmitted && new Date() > new Date(today + 'T23:59:59')

  useEffect(() => {
    if (log) {
      setStandup({
        what_i_did:    log.what_i_did ?? '',
        blockers:      log.blockers ?? '',
        tomorrow_plan: log.tomorrow_plan ?? '',
      })
    }
  }, [log?.id])

  async function ensureLog() {
    if (log) return log
    return upsert.mutateAsync({})
  }

  async function handleAddTask() {
    const currentLog = await ensureLog()
    await addTask.mutateAsync({ title: '', status: 'pending', log_id: currentLog.id })
  }

  async function handleUpdateTask(fields) {
    if (!fields.id) return
    await updateTask.mutateAsync(fields)
  }

  async function handleSaveDraft() {
    setSaving(true)
    await upsert.mutateAsync(standup)
    setSaving(false)
  }

  async function handleSubmit() {
    setSaving(true)
    const currentLog = await upsert.mutateAsync(standup)
    await submit.mutateAsync(currentLog.id)
    setSaving(false)
  }

  async function handleEdit() {
    if (log) await unsubmit.mutateAsync(log.id)
  }

  if (logLoading) return <div className="text-sm text-gray-400 p-4">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Today's Log</h2>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        {isSubmitted && <Badge variant="submitted">Submitted</Badge>}
      </div>

      {/* Tasks */}
      <Card className="p-5">
        <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-4">Tasks</p>
        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">No tasks yet. Add one below.</p>
        )}
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            categories={categories}
            onUpdate={handleUpdateTask}
            onDelete={id => deleteTask.mutate(id)}
            disabled={isLocked}
          />
        ))}
        {!isLocked && (
          <button
            onClick={handleAddTask}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            + Add task
          </button>
        )}
      </Card>

      {/* Standup */}
      <Card className="p-5 space-y-4">
        <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Standup Notes</p>

        {[
          { key: 'what_i_did',    label: 'What I did today',     placeholder: 'Summary of what you accomplished…', rows: 3 },
          { key: 'blockers',      label: 'Blockers',              placeholder: 'Anything blocking your progress? (leave blank if none)', rows: 2 },
          { key: 'tomorrow_plan', label: 'Plan for tomorrow',     placeholder: 'What will you work on tomorrow?', rows: 2 },
        ].map(({ key, label, placeholder, rows }) => (
          <div key={key}>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">{label}</label>
            <textarea
              rows={rows}
              disabled={isLocked}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none disabled:bg-gray-50 transition"
              placeholder={placeholder}
              value={standup[key]}
              onChange={e => setStandup(s => ({ ...s, [key]: e.target.value }))}
            />
          </div>
        ))}
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {isLocked ? (
          <p className="text-sm text-gray-400">This entry is locked after midnight.</p>
        ) : isSubmitted ? (
          <button
            onClick={handleEdit}
            disabled={saving}
            className="px-4 py-2 border border-primary-600 text-primary-600 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors disabled:opacity-50"
          >
            Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || tasks.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
