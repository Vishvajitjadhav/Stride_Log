import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCategories } from '../../hooks/useCategories'
import { usePeople } from '../../hooks/usePeople'
import { useTaskMutations } from '../../hooks/useTasks'
import { todayISO, formatDisplay } from '../../utils/dates'
import { STATUS_LABELS } from '../../lib/labels'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'

const STATUSES = ['pending', 'in_progress', 'done', 'blocked']
const PRIORITIES = ['low', 'normal', 'high']

// Create / edit / assign a task. `task` = existing row (edit) or undefined (new).
// `assignTo` = preselect an assignee (e.g. from a team member page);
// '' = assigning, but let the user pick who.
export default function TaskEditor({ open, onClose, task, assignTo, defaultDate }) {
  const { userId, can } = useAuth()
  const canAssign = can('assignTasks')
  const isNew = !task
  const picking = assignTo === ''
  const ownerId = task?.user_id ?? (assignTo || userId)
  const isMine = ownerId === userId
  // An employee can't rewrite the details of work someone assigned them.
  const lockDetails = !isNew && task.assigned_by && !canAssign

  const { data: categories = [] } = useCategories()
  const { data: people = [] } = usePeople({ enabled: canAssign && open })
  const { add, update, remove } = useTaskMutations()

  const [form, setForm] = useState(() => ({
    user_id: picking ? '' : ownerId,
    title: task?.title ?? '',
    category_id: task?.category_id ?? '',
    status: task?.status ?? 'pending',
    priority: task?.priority ?? 'normal',
    date: task?.date ?? defaultDate ?? todayISO(),
    due_date: task?.due_date ?? '',
    description: task?.description ?? '',
  }))
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const canDelete = !isNew && (canAssign || (isMine && !task.assigned_by))
  const busy = add.isPending || update.isPending || remove.isPending

  async function handleSave(e) {
    e?.preventDefault()
    if (!form.user_id) { setError('Choose who the task is for.'); return }
    if (!form.title.trim()) { setError('Give the task a title.'); return }
    setError('')
    const fields = {
      user_id: form.user_id,
      title: form.title.trim(),
      category_id: form.category_id || null,
      status: form.status,
      priority: form.priority,
      date: form.date,
      due_date: form.due_date || null,
      description: form.description.trim() || null,
    }
    try {
      if (isNew) await add.mutateAsync(fields)
      else await update.mutateAsync({ id: task.id, ...fields })
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    try {
      await remove.mutateAsync(task.id)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  const title = isNew ? (form.user_id !== userId ? 'Assign task' : 'New task') : 'Task'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          {canDelete && (
            <Button variant="outline" className="mr-auto text-red-600" onClick={handleDelete} disabled={busy}>Delete</Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={busy}>{isNew && form.user_id !== userId ? 'Assign' : 'Save'}</Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {task?.assigner && (
          <p className="text-xs text-sky-700 bg-sky-50 rounded-lg px-3 py-2">
            Assigned by <strong>{task.assigner.name}</strong>
            {task.editor && task.editor.id !== task.user_id && task.editor.id !== task.assigned_by && (
              <> · last edited by <strong>{task.editor.name}</strong></>
            )}
          </p>
        )}

        {canAssign && (isNew || !isMine) && (
          <div>
            <label className="label" htmlFor="t-owner">Assign to</label>
            <select id="t-owner" className="field" value={form.user_id} onChange={e => set('user_id', e.target.value)} disabled={!isNew}>
              {picking && <option value="">Choose a person…</option>}
              <option value={userId}>Me</option>
              {people.filter(p => p.id !== userId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="t-title">Task</label>
          <input id="t-title" className="field" autoFocus={isNew} value={form.title} disabled={lockDetails}
            placeholder="What needs to be done?" onChange={e => set('title', e.target.value)} />
        </div>

        <div>
          <span className="label">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(c => {
              const active = form.category_id === c.id
              return (
                <button type="button" key={c.id} onClick={() => set('category_id', active ? '' : c.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={active
                    ? { background: c.color, borderColor: c.color, color: '#fff' }
                    : { borderColor: c.color + '55', color: c.color, background: c.color + '10' }}>
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className="label">Status</span>
          <div className="grid grid-cols-4 gap-1.5">
            {STATUSES.map(s => (
              <button type="button" key={s} onClick={() => set('status', s)}
                className={`py-2 rounded-lg text-xs font-medium border ${form.status === s ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-200 text-gray-600'}`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-date">Planned for</label>
            <input id="t-date" type="date" className="field" value={form.date} disabled={lockDetails}
              onChange={e => set('date', e.target.value || todayISO())} />
          </div>
          <div>
            <label className="label" htmlFor="t-due">Due date</label>
            <input id="t-due" type="date" className="field" value={form.due_date} disabled={lockDetails}
              onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>

        <div>
          <span className="label">Priority</span>
          <div className="grid grid-cols-3 gap-1.5">
            {PRIORITIES.map(p => (
              <button type="button" key={p} disabled={lockDetails} onClick={() => set('priority', p)}
                className={`py-2 rounded-lg text-xs font-medium border capitalize ${form.priority === p ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-desc">Notes</label>
          <textarea id="t-desc" rows={3} className="field resize-none" value={form.description} disabled={lockDetails}
            placeholder="Details, links, acceptance criteria…" onChange={e => set('description', e.target.value)} />
        </div>

        {!isNew && task.completed_on && (
          <p className="text-xs text-gray-400">Completed {formatDisplay(task.completed_on)}</p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
