import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDayTasks, useTaskMutations, useTasksRealtime } from '../hooks/useTasks'
import { useWorkLog } from '../hooks/useWorkLog'
import { useCategories } from '../hooks/useCategories'
import { useHolidays } from '../hooks/useOrg'
import { useProjects, projectsOf } from '../hooks/useProjects'
import { useAutoSync } from '../hooks/useIntegrations'
import AppLogo from '../components/integrations/AppLogo'
import { toast } from '../lib/toast'
import { todayISO, addDaysISO, formatShort, formatLong, isWorkingDay } from '../utils/dates'
import TaskItem from '../components/tasks/TaskItem'
import TaskEditor from '../components/tasks/TaskEditor'
import Card, { Section } from '../components/ui/Card'
import Tooltip from '../components/ui/Tooltip'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Select from '../components/ui/Select'

const NOTE_FIELDS = [
  { key: 'what_i_did', label: 'Summary',  placeholder: 'What you achieved today', rows: 2 },
  { key: 'blockers',   label: 'Blockers', placeholder: 'Anything slowing you down. Leave blank if none.', rows: 2 },
]

function TaskGroup({ title, tip, collapsible, open = true, onToggle, children }) {
  return (
    <div className="mt-3 first:mt-0">
      {title && (
        <div className="flex items-center gap-1.5 pt-2 pb-1">
          {collapsible ? (
            <button onClick={onToggle} className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              {title}<Icon name="down" size={14} className={open ? 'rotate-180' : ''} />
            </button>
          ) : <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>}
          {tip && <Tooltip text={tip} />}
        </div>
      )}
      {open && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  )
}

const draftKey = (uid, date) => `stridelog:notes:${uid}:${date}`
function readDraft(uid, date) {
  try { return JSON.parse(localStorage.getItem(draftKey(uid, date))) } catch { return null }
}
function writeDraft(uid, date, notes) {
  try { localStorage.setItem(draftKey(uid, date), JSON.stringify(notes)) } catch { /* storage unavailable */ }
}
function clearDraft(uid, date) {
  try { localStorage.removeItem(draftKey(uid, date)) } catch { /* storage unavailable */ }
}

export default function MyDay() {
  const { userId } = useAuth()
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || today
  const isToday = date === today
  const setDate = d => setParams(d === today ? {} : { date: d }, { replace: true })

  useTasksRealtime(userId)
  const { data: tasks = [], isLoading } = useDayTasks(userId, date, { carryOver: isToday })
  const { data: log, save } = useWorkLog(date)
  const { data: categories = [] } = useCategories()
  const { data: holidays } = useHolidays()
  const { data: projects = [] } = useProjects()
  const myProjects = projectsOf(projects, userId)
  const { add, update } = useTaskMutations()
  const teams = useAutoSync('teams')
  const jira = useAutoSync('jira')
  async function syncAll() {
    const runs = [teams.active && teams.sync.mutateAsync('me'), jira.active && jira.sync.mutateAsync('me')].filter(Boolean)
    try {
      const results = await Promise.all(runs)
      const created = results.reduce((n, r) => n + (r.created ?? 0), 0)
      const updated = results.reduce((n, r) => n + (r.updated ?? 0), 0)
      toast(created ? `${created} new ${created === 1 ? 'task' : 'tasks'} added` : updated ? `${updated} ${updated === 1 ? 'task' : 'tasks'} updated` : 'Everything is up to date')
    } catch (e) { toast.error(e.message) }
  }

  const [editing, setEditing] = useState(null)   // task | 'new' | null
  const [quick, setQuick] = useState('')
  const [quickCat, setQuickCat] = useState('')
  const [quickProject, setQuickProject] = useState(() => { try { return localStorage.getItem('stridelog:project') ?? '' } catch { return '' } })
  const [notes, setNotes] = useState({ what_i_did: '', blockers: '' })
  const [showDone, setShowDone] = useState(true)
  const loadedFor = useRef(null)

  // Load notes: local draft wins (it may hold offline edits), else server.
  useEffect(() => {
    if (log === undefined || loadedFor.current === date) return
    loadedFor.current = date
    const draft = readDraft(userId, date)
    setNotes(draft ?? {
      what_i_did: log?.what_i_did ?? '',
      blockers: log?.blockers ?? '',
    })
  }, [log, date, userId])

  function changeNote(key, value) {
    const next = { ...notes, [key]: value }
    setNotes(next)
    writeDraft(userId, date, next)
  }

  const working = isWorkingDay(date, holidays?.set)
  const holidayName = holidays?.byDate?.[date]
  const submitted = Boolean(log?.submitted_at)

  const { open, done, carried } = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done' && t.date === date)
    const carried = tasks.filter(t => t.status !== 'done' && t.date < date)
    const done = tasks.filter(t => t.status === 'done')
    return { open, done, carried }
  }, [tasks, date])
  const total = tasks.length
  const pct = total ? Math.round((done.length / total) * 100) : 0

  async function quickAdd(e) {
    e.preventDefault()
    const title = quick.trim()
    if (!title) return
    setQuick('')
    // One project: always use it. Several: use the one picked (remembered).
    const project_id = myProjects.length === 1 ? myProjects[0].id
      : myProjects.some(p => p.id === quickProject) ? quickProject : null
    await add.mutateAsync({ title, date, category_id: quickCat || null, project_id })
  }

  function setStatus(task, status) {
    update.mutate({ id: task.id, status })
  }

  async function saveNotes() {
    await save.mutateAsync(notes)
    clearDraft(userId, date)
    toast('Notes saved')
  }

  async function submit() {
    await save.mutateAsync({ ...notes, submitted_at: new Date().toISOString() })
    clearDraft(userId, date)
    toast(working ? 'Day submitted. Well done.' : 'Extra day logged. Thank you.')
  }

  async function reopen() {
    await save.mutateAsync({ submitted_at: null })
  }


  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header + day switcher */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title">{isToday ? 'Today' : formatShort(date)}</h2>
          <p className="page-subtitle">{formatLong(date)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isToday && <Button variant="outline" size="sm" onClick={() => setDate(today)}>Today</Button>}
          <div className="flex items-center bg-surface border border-gray-200 rounded-md">
            <button onClick={() => setDate(addDaysISO(date, -1))} className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Previous day"><Icon name="left" size={16} /></button>
            <button onClick={() => setDate(addDaysISO(date, 1))} disabled={date >= today} className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Next day"><Icon name="right" size={16} /></button>
          </div>
        </div>
      </div>

      {!working && (
        <p className="text-sm text-accent-700 bg-accent-50 border border-accent-100 rounded-lg px-4 py-2.5">
          {holidayName ? `${holidayName} is a company holiday.` : 'It is the weekend.'} Logging is optional and counts as an extra day.
        </p>
      )}

      {/* Progress */}
      <Card className="px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm text-gray-600"><span className="text-base font-semibold text-gray-900 tabular-nums">{done.length} of {total}</span> tasks done</p>
          {submitted ? <Badge variant="submitted">Day submitted</Badge> : <Badge variant="draft">Not submitted yet</Badge>}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {isToday && (teams.active || jira.active) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 -mt-2 px-1">
          {teams.active && <AppLogo app="teams" size={16} />}
          {jira.active && <AppLogo app="jira" size={16} />}
          <span>
            {teams.syncing || jira.syncing
              ? `Syncing ${[teams.syncing && 'Teams', jira.syncing && 'Jira'].filter(Boolean).join(' and ')}`
              : `${[teams.active && 'Teams meetings', jira.active && 'Jira issues'].filter(Boolean).join(' and ')} update automatically.`}
          </span>
          {!teams.syncing && !jira.syncing && (
            <button onClick={syncAll} className="font-medium text-primary-600 hover:text-primary-700 hover:underline underline-offset-2">Sync now</button>
          )}
        </div>
      )}

      {/* Tasks */}
      <Section title="Tasks" hint="Tap the circle to mark a task done. Tap a task to edit it." bodyClassName="px-5 pb-4 pt-3">
        <form onSubmit={quickAdd} className="flex gap-2">
          <input value={quick} onChange={e => setQuick(e.target.value)} placeholder="Add a task" className="field flex-1" aria-label="New task" enterKeyHint="done" />
          <Select value={quickCat} onChange={e => setQuickCat(e.target.value)} className="field !w-[6.5rem] sm:!w-40" aria-label="Category">
            <option value="">Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {myProjects.length > 1 && (
            <Select value={quickProject} aria-label="Project" className="field !w-[6.5rem] sm:!w-40"
              onChange={e => { setQuickProject(e.target.value); try { localStorage.setItem('stridelog:project', e.target.value) } catch { /* storage unavailable */ } }}>
              <option value="">Project</option>
              {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <Button type="submit" disabled={!quick.trim()} aria-label="Add task"><Icon name="plus" size={16} /><span className="hidden sm:inline">Add</span></Button>
        </form>
        <button onClick={() => setEditing('new')} className="text-xs font-medium text-primary-700 hover:text-primary-900 mt-2">
          Add with due date or notes
        </button>

        {isLoading ? (
          <div className="space-y-2 mt-4">{[0, 1, 2].map(i => <div key={i} className="h-10 rounded-md skeleton" />)}</div>
        ) : total === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No tasks yet. Add what you are working on today.</p>
        ) : (
          <div className="mt-3">
            {carried.length > 0 && (
              <TaskGroup title={`Carried over (${carried.length})`} tip="Unfinished tasks from earlier days. Finish them or move them to another day.">
                {carried.map(t => <TaskItem key={t.id} task={t} contextDate={date} onStatus={setStatus} onOpen={setEditing} />)}
              </TaskGroup>
            )}
            {open.length > 0 && (
              <TaskGroup title={carried.length ? `${isToday ? 'Today' : 'This day'} (${open.length})` : null}>
                {open.map(t => <TaskItem key={t.id} task={t} contextDate={date} onStatus={setStatus} onOpen={setEditing} />)}
              </TaskGroup>
            )}
            {done.length > 0 && (
              <TaskGroup title={`Done (${done.length})`} collapsible open={showDone} onToggle={() => setShowDone(v => !v)}>
                {done.map(t => <TaskItem key={t.id} task={t} contextDate={date} onStatus={setStatus} onOpen={setEditing} />)}
              </TaskGroup>
            )}
          </div>
        )}
      </Section>

      {/* Notes */}
      <Section title="Daily notes" hint="Optional. Your manager sees these with your tasks." bodyClassName="px-5 pb-5 pt-3 space-y-4">
        {NOTE_FIELDS.map(f => (
          <div key={f.key}>
            <label className="label" htmlFor={`n-${f.key}`}>{f.label}</label>
            <textarea id={`n-${f.key}`} rows={f.rows} className="field resize-none" placeholder={f.placeholder}
              value={notes[f.key]} onChange={e => changeNote(f.key, e.target.value)} />
          </div>
        ))}
      </Section>

      {/* Actions, sticky above the tab bar on phones */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20">
        <div className="bg-surface border border-gray-200 rounded-lg shadow-[0_4px_16px_rgba(15,23,42,0.08)] px-4 py-3 flex items-center gap-2">
          <p className="flex-1 text-xs text-gray-500 truncate hidden sm:block">{submitted ? 'Submitted. You can still edit today.' : 'Submit when you finish for the day.'}</p>
          <div className="flex-1 sm:hidden" />
          {submitted ? (
            <Button variant="outline" onClick={reopen} loading={save.isPending}>Edit submission</Button>
          ) : (
            <>
              <Button variant="outline" onClick={saveNotes} loading={save.isPending && !save.variables?.submitted_at}>Save</Button>
              <Button onClick={submit} disabled={total === 0 && !notes.what_i_did.trim()} loading={save.isPending && Boolean(save.variables?.submitted_at)}>
                Submit day
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <TaskEditor
          key={editing === 'new' ? 'new' : editing.id}
          open
          task={editing === 'new' ? undefined : editing}
          defaultDate={date}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
