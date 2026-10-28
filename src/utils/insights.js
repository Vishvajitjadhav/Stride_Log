// Plain answers for the Reports page: how work splits by status, whether each
// person and project is improving against their own recent weeks, what needs
// attention, and a few sentences a CEO can read in seconds.

import { STATUSES } from '../lib/status'
import { addDaysISO, weekStartISO } from './dates'
import { workingDaysSince, STUCK_DAYS } from './board'

// Charts and exports read best with finished work first.
export const STATUS_ORDER = ['done', 'in_review', 'in_progress', 'pending', 'blocked']

// -> { pending, in_progress, in_review, done, blocked }
export function statusCounts(tasks = []) {
  const c = Object.fromEntries(STATUSES.map(s => [s, 0]))
  tasks.forEach(t => { c[t.status in c ? t.status : 'pending']++ })
  return c
}

// The last `n` week starts (Monday) up to the week holding `to`, oldest first.
export function lastWeeks(to, n = 6) {
  const last = weekStartISO(to)
  return Array.from({ length: n }, (_, i) => addDaysISO(last, -7 * (n - 1 - i)))
}

// Tasks finished in each week (by the day they were finished).
export function weeklyDone(tasks, weeks) {
  return weeks.map(w => {
    const end = addDaysISO(w, 6)
    return tasks.filter(t => t.status === 'done' && (t.completed_on ?? t.date) >= w && (t.completed_on ?? t.date) <= end).length
  })
}

// Compare the last 3 weeks with the 3 before, against the person's (or
// project's) own past, never against someone else.
//   'up' Improving | 'down' Dropping | 'steady' | 'new' not enough history
export function trendLabel(series) {
  if (series.length < 6) return 'new'
  const avg = a => a.reduce((n, v) => n + v, 0) / a.length
  const recent = avg(series.slice(-3))
  const before = avg(series.slice(-6, -3))
  // Nothing to compare with (new joiner, or no work yet).
  if (before === 0) return 'new'
  if (recent - before >= 1 && recent >= before * 1.15) return 'up'
  if (before - recent >= 1 && recent <= before * 0.85) return 'down'
  return 'steady'
}

export const TREND = {
  up: { label: 'Improving', cls: 'bg-mint-50 text-mint-700 ring-mint-200', icon: 'trend' },
  steady: { label: 'Steady', cls: 'bg-gray-50 text-gray-600 ring-gray-200', icon: 'right' },
  down: { label: 'Dropping', cls: 'bg-red-50 text-red-700 ring-red-200', icon: 'trend' },
  new: { label: 'Not enough data', cls: 'bg-gray-50 text-gray-500 ring-gray-200', icon: null },
}

// Open work that needs a look: blocked, past its due date, or no change for
// STUCK_DAYS working days. -> { blocked, overdue, stuck, total }
export function attention(tasks, today, holidays) {
  const open = tasks.filter(t => t.status !== 'done')
  const blocked = open.filter(t => t.status === 'blocked').length
  const overdue = open.filter(t => t.due_date && t.due_date < today).length
  const stuck = open.filter(t => t.status !== 'blocked' && t.changed_at && workingDaysSince(t.changed_at.slice(0, 10), today, holidays) >= STUCK_DAYS).length
  const total = open.filter(t => t.status === 'blocked' || (t.due_date && t.due_date < today)
    || (t.changed_at && workingDaysSince(t.changed_at.slice(0, 10), today, holidays) >= STUCK_DAYS)).length
  return { blocked, overdue, stuck, total }
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const names = list => (list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`)

// A few short sentences, most important first.
//   persons / projects: rows with { name, done, planned, trend }
export function insights({ current, previous, against, persons = [], projects = [], att }) {
  if (!current.planned && !current.done) return ['No work was planned or finished in this period.']
  const out = []

  if (previous?.planned) {
    const d = current.done - previous.done
    out.push(d === 0
      ? `${plural(current.done, 'task')} finished, the same as ${against}.`
      : `${plural(current.done, 'task')} finished, ${Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} than ${against}.`)
  } else {
    out.push(`${plural(current.done, 'task')} finished.`)
  }
  out.push(`${current.completionRate}% of planned work is done${current.planned ? ` (${current.done} of ${current.planned})` : ''}.`)

  const topProject = [...projects].filter(p => p.done > 0).sort((a, b) => b.done - a.done)[0]
  if (topProject) out.push(`${topProject.name} moved the most: ${plural(topProject.done, 'task')} done${topProject.planned ? `, ${topProject.completionRate}% of its planned work` : ''}.`)

  if (persons.length > 1) {
    const up = persons.filter(p => p.trend === 'up').map(p => p.name)
    const down = persons.filter(p => p.trend === 'down').map(p => p.name)
    if (up.length) out.push(`Improving on their own recent weeks: ${names(up)}.`)
    if (down.length) out.push(`Finishing less than their recent weeks: ${names(down)}.`)
  } else if (persons.length === 1 && persons[0].trend !== 'new') {
    out.push(`Compared with their own recent weeks: ${TREND[persons[0].trend].label.toLowerCase()}.`)
  }

  if (att?.total) {
    const parts = [att.blocked && `${att.blocked} blocked`, att.overdue && `${att.overdue} overdue`, att.stuck && `${att.stuck} with no change for ${STUCK_DAYS} working days`].filter(Boolean)
    out.push(`${plural(att.total, 'item needs', 'items need')} attention: ${parts.join(', ')}.`)
  }
  return out
}
