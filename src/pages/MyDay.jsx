import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDayTasks, useTaskMutations, useTasksRealtime } from '../hooks/useTasks'
import { useWorkLog } from '../hooks/useWorkLog'
import { useCategories } from '../hooks/useCategories'
import { useHolidays } from '../hooks/useOrg'
import { todayISO, addDaysISO, formatShort, isWorkingDay } from '../utils/dates'
import TaskItem from '../components/tasks/TaskItem'
import TaskEditor from '../components/tasks/TaskEditor'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

const NOTE_FIELDS = [
  { key: 'what_i_did',    label: 'Highlights',        placeholder: 'What went well / what you shipped today', rows: 2 },
  { key: 'blockers',      label: 'Blockers',          placeholder: 'Anything slowing you down? (leave blank if none)', rows: 2 },
  { key: 'tomorrow_plan', label: 'Plan for tomorrow', placeholder: 'What will you pick up next?', rows: 2 },
]

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
  const { add, update } = useTaskMutations()

  const [editing, setEditing] = useState(null)   // task | 'new' | null
  const [quick, setQuick] = useState('')
  const [quickCat, setQuickCat] = useState('')
  const [notes, setNotes] = useState({ what_i_did: '', blockers: '', tomorrow_plan: '' })
  const [showDone, setShowDone] = useState(true)
  const [msg, setMsg] = useState('')
  const loadedFor = useRef(null)

  // Load notes: local draft wins (it may hold offline edits), else server.
  useEffect(() => {
    if (log === undefined || loadedFor.current === date) return
    loadedFor.current = date
    const draft = readDraft(userId, date)
    setNotes(draft ?? {
      what_i_did: log?.what_i_did ?? '',
      blockers: log?.blockers ?? '',
      tomorrow_plan: log?.tomorrow_plan ?? '',
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
    await add.mutateAsync({ title, date, category_id: quickCat || null })
  }

  function setStatus(task, status) {
    update.mutate({ id: task.id, status })
  }

  async function saveNotes() {
    await save.mutateAsync(notes)
    clearDraft(userId, date)
    flash('Notes saved')
  }

  async function submit() {
    await save.mutateAsync({ ...notes, submitted_at: new Date().toISOString() })
    clearDraft(userId, date)
    flash(working ? 'Day submitted — nice work!' : 'Extra day logged ★ thanks!')
  }

  async function reopen() {
    await save.mutateAsync({ submitted_at: null })
  }

  function flash(text) {
    setMsg(text)
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Day switcher */}
      <div className="flex items-center gap-2">
        <button onClick={() => setDate(addDaysISO(date, -1))} className="p-2 rounded-lg hover:bg-white text-gray-500" aria-label="Previous day">
          <Icon name="left" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-gray-900">{isToday ? 'Today' : formatShort(date)}</p>
          <p className="text-xs text-gray-400">{isToday ? formatShort(date) : <button onClick={() => setDate(today)} className="text-primary-600">Back to today</button>}</p>
        </div>
        <button onClick={() => setDate(addDaysISO(date, 1))} disabled={date >= today} className="p-2 rounded-lg hover:bg-white text-gray-500 disabled:opacity-30" aria-label="Next day">
          <Icon name="right" />
        </button>
      </div>

      {!working && (
        <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5">
          <Icon name="star" size={16} />
          <span>{holidayName ? `${holidayName} — holiday.` : 'Weekend.'} Logging is optional and counts as an extra day.</span>
        </div>
      )}

      {/* Progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">{done.length} of {total} done</span>
          {submitted ? <Badge variant="submitted">Submitted</Badge> : <Badge variant="draft">Not submitted</Badge>}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Tasks */}
      <Card className="p-4">
        <form onSubmit={quickAdd} className="flex gap-2">
          <input
            value={quick}
            onChange={e => setQuick(e.target.value)}
            placeholder="Add a task…"
            className="field flex-1"
            aria-label="New task"
            enterKeyHint="done"
          />
          <Button type="submit" className="!px-3" aria-label="Add task" disabled={!quick.trim()}>
            <Icon name="plus" size={18} />
          </Button>
        </form>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none mt-2 -mx-4 px-4" role="radiogroup" aria-label="Category for new task">
          {categories.map(c => {
            const active = quickCat === c.id
            return (
              <button key={c.id} type="button" role="radio" aria-checked={active} onClick={() => setQuickCat(active ? '' : c.id)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors"
                style={active
                  ? { background: c.color, borderColor: c.color, color: '#fff' }
                  : { borderColor: c.color + '55', color: c.color, background: c.color + '10' }}>
                {c.name}
              </button>
            )
          })}
        </div>
        <button onClick={() => setEditing('new')} className="text-xs text-primary-600 font-medium mt-2">
          + More options (due date, priority, notes…)
        </button>

        {isLoading ? (
          <div className="space-y-2 mt-4">{[0, 1, 2].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
        ) : total === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-1">📝</p>
            <p className="text-sm text-gray-400">No tasks yet. Add what you're working on today.</p>
          </div>
        ) : (
          <div className="mt-2">
            {carried.length > 0 && (
              <>
                <p className="section-title !text-amber-600 mt-3">Carried over · {carried.length}</p>
                <div className="divide-y divide-gray-50">
                  {carried.map(t => <TaskItem key={t.id} task={t} contextDate={date} onStatus={setStatus} onOpen={setEditing} />)}
                </div>
              </>
            )}
            {open.length > 0 && (
              <>
                {carried.length > 0 && <p className="section-title mt-4">{isToday ? 'Today' : 'This day'} · {open.length}</p>}
                <div className="divide-y divide-gray-50">
                  {open.map(t => <TaskItem key={t.id} task={t} contextDate={date} onStatus={setStatus} onOpen={setEditing} />)}
                </div>
              </>
            )}
            {done.length > 0 && (
              <>
                <button onClick={() => setShowDone(s => !s)} className="section-title !text-green-600 mt-4 flex items-center gap-1">
                  Done · {done.length} <Icon name="down" size={14} className={showDone ? 'rotate-180' : ''} />
                </button>
                {showDone && (
                  <div className="divide-y divide-gray-50">
                    {done.map(t => <TaskItem key={t.id} task={t} contextDate={date} onStatus={setStatus} onOpen={setEditing} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-4 space-y-3">
        <p className="section-title">Daily notes</p>
        {NOTE_FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-sm font-medium text-gray-700 block mb-1" htmlFor={`n-${f.key}`}>{f.label}</label>
            <textarea id={`n-${f.key}`} rows={f.rows} className="field resize-none" placeholder={f.placeholder}
              value={notes[f.key]} onChange={e => changeNote(f.key, e.target.value)} />
          </div>
        ))}
      </Card>

      {/* Actions — sticky above the tab bar on phones */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20">
        <div className="bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-lg p-3 flex items-center gap-2">
          <p className="flex-1 text-sm text-green-700 font-medium truncate">{msg}</p>
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
