import Icon from '../ui/Icon'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCategories } from '../../hooks/useCategories'
import { usePeople } from '../../hooks/usePeople'
import { useTaskMutations } from '../../hooks/useTasks'
import { useProjects, projectsOf } from '../../hooks/useProjects'
import { todayISO, formatDisplay } from '../../utils/dates'
import { STATUS_LABELS } from '../../lib/labels'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import { toast } from '../../lib/toast'
import Select from '../ui/Select'

const STATUSES = ['pending', 'in_progress', 'done', 'blocked']

// Create / edit / assign a task. `task` = existing row (edit) or undefined (new).
// `assignTo` = preselect an assignee (e.g. from a team member page);
// '' = assigning, but let the user pick who.
// Kept short on purpose: Task, Category, Status, Due date. Notes and the
// planned day sit behind "Add details".
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
  const { data: projects = [] } = useProjects()
  const { add, update, remove } = useTaskMutations()

  const [form, setForm] = useState(() => ({
    user_id: picking ? '' : ownerId,
    title: task?.title ?? '',
    category_id: task?.category_id ?? '',
    status: task?.status ?? 'pending',
    date: task?.date ?? defaultDate ?? todayISO(),
    due_date: task?.due_date ?? '',
    description: task?.description ?? '',
    // undefined until picked: new tasks then default to the person's only project.
    project_id: task ? (task.project_id ?? '') : undefined,
  }))
  const [details, setDetails] = useState(Boolean(task?.description))
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const canDelete = !isNew && (canAssign || (isMine && !task.assigned_by))
  const busy = add.isPending || update.isPending || remove.isPending
  const assigning = isNew && form.user_id !== userId
  // Projects of the person the task is for; the field only shows when they have any.
  const ownProjects = projectsOf(projects, form.user_id)
  const projectId = form.project_id ?? (ownProjects.length === 1 ? ownProjects[0].id : '')

  async function handleSave(e) {
    e?.preventDefault()
    if (!form.user_id) { setError('Choose who the task is for.'); return }
    if (!form.title.trim()) { setError('Enter a task name.'); return }
    setError('')
    const fields = {
      user_id: form.user_id,
      title: form.title.trim(),
      category_id: form.category_id || null,
      status: form.status,
      date: form.date,
      due_date: form.due_date || null,
      description: form.description.trim() || null,
      project_id: projectId || null,
    }
    try {
      if (isNew) await add.mutateAsync(fields)
      else await update.mutateAsync({ id: task.id, ...fields })
      const who = people.find(p => p.id === fields.user_id)?.name
      toast(isNew ? (fields.user_id !== userId && who ? `Task assigned to ${who}` : 'Task added') : 'Task saved')
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    try {
      await remove.mutateAsync(task.id)
      toast('Task deleted')
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? (assigning || picking ? 'Assign a task' : 'New task') : 'Edit task'}
      footer={
        <>
          {canDelete && (
            <Button variant="outline" className="mr-auto !text-red-700" onClick={handleDelete} disabled={busy}>Delete</Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={busy}>{assigning || picking ? 'Assign' : 'Save'}</Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {task?.assigner && (
          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            Assigned by <span className="font-medium text-gray-900">{task.assigner.name}</span>
            {task.editor && task.editor.id !== task.user_id && task.editor.id !== task.assigned_by && (
              <>, last edited by <span className="font-medium text-gray-900">{task.editor.name}</span></>
            )}
          </p>
        )}

        {canAssign && (isNew || !isMine) && (
          <div>
            <label className="label" htmlFor="t-owner">Assign to</label>
            <Select id="t-owner" className="field" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value, project_id: undefined }))} disabled={!isNew}>
              {picking && <option value="">Choose an employee</option>}
              <option value={userId}>Myself</option>
              {people.filter(p => p.id !== userId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="t-title">Task</label>
          <input id="t-title" className="field" autoFocus={isNew} value={form.title} disabled={lockDetails}
            placeholder="What needs to be done" onChange={e => set('title', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-cat">Category</label>
            <Select id="t-cat" className="field" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">None</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="t-due">Due date <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="t-due" type="date" className="field" value={form.due_date} disabled={lockDetails}
              onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>

        {ownProjects.length > 0 && (
          <div>
            <label className="label" htmlFor="t-project">Project <span className="font-normal text-gray-400">(optional)</span></label>
            <Select id="t-project" className="field" value={projectId}
              onChange={e => set('project_id', e.target.value)}>
              <option value="">No project</option>
              {ownProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        )}

        <div>
          <span className="label">Status</span>
          <div className="segmented w-full grid grid-cols-4" role="group" aria-label="Status">
            {STATUSES.map(s => (
              <button type="button" key={s} aria-pressed={form.status === s} onClick={() => set('status', s)} className="!px-1">
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {task?.source === 'jira' && (
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
              Status follows Jira and updates on the next sync.
              {task.external_url && (
                <a href={task.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline">
                  Open {task.external_id} <Icon name="external" size={12} />
                </a>
              )}
            </p>
          )}
        </div>

        {details ? (
          <div className="space-y-4 pt-1">
            <div>
              <label className="label" htmlFor="t-desc">Notes</label>
              <textarea id="t-desc" rows={3} className="field resize-none" value={form.description} disabled={lockDetails}
                placeholder="Links, context or what done looks like" onChange={e => set('description', e.target.value)} />
            </div>
            <div className="w-1/2 pr-1.5">
              <label className="label" htmlFor="t-date">Planned for</label>
              <input id="t-date" type="date" className="field" value={form.date} disabled={lockDetails}
                onChange={e => set('date', e.target.value || todayISO())} />
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setDetails(true)} className="text-sm font-medium text-primary-700 hover:text-primary-900">
            Add details
          </button>
        )}

        {!isNew && task.completed_on && (
          <p className="text-xs text-gray-500">Completed on {formatDisplay(task.completed_on)}</p>
        )}
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
