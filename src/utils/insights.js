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

// Compare the last finished week with the two before it, against the
// person's (or project's) own past, never against someone else.
//   'up' Improving | 'down' Dropping | 'steady' | 'new' not enough history
export function trendLabel(series) {
  if (series.length < 3) return 'new'
  const last = series[series.length - 1]
  const before = (series[series.length - 2] + series[series.length - 3]) / 2
  // Nothing to compare with (new joiner, or no work yet).
  if (before === 0) return 'new'
  if (last - before >= 1 && last >= before * 1.15) return 'up'
  if (before - last >= 1 && last <= before * 0.85) return 'down'
  return 'steady'
}

export const TREND = {
  up: { label: 'Improving', cls: 'bg-mint-50 text-mint-700 ring-mint-200', icon: 'trend' },
  steady: { label: 'Steady', cls: 'bg-gray-50 text-gray-600 ring-gray-200', icon: 'right' },
  down: { label: 'Dropping', cls: 'bg-red-50 text-red-700 ring-red-200', icon: 'trend' },
  new: { label: 'Not enough data', cls: 'bg-gray-50 text-gray-500 ring-gray-200', icon: null },
}

// Open work that needs a look, most urgent first: blocked, then past its
// due date, then no change for STUCK_DAYS working days (each task once).
//   -> [{ task, reason: 'blocked' | 'overdue' | 'stuck', idle }]
const URGENCY = { blocked: 0, overdue: 1, stuck: 2 }
export function attentionItems(tasks, today, holidays) {
  return tasks
    .filter(t => t.status !== 'done')
    .map(t => {
      const idle = t.changed_at ? workingDaysSince(t.changed_at.slice(0, 10), today, holidays) : 0
      const reason = t.status === 'blocked' ? 'blocked' : t.due_date && t.due_date < today ? 'overdue' : idle >= STUCK_DAYS ? 'stuck' : null
      return reason && { task: t, reason, idle }
    })
    .filter(Boolean)
    .sort((a, b) => URGENCY[a.reason] - URGENCY[b.reason] || b.idle - a.idle)
}

// -> { blocked, overdue, stuck, total, items }
export function attention(tasks, today, holidays) {
  const items = attentionItems(tasks, today, holidays)
  const count = r => items.filter(i => i.reason === r).length
  return { blocked: count('blocked'), overdue: count('overdue'), stuck: count('stuck'), total: items.length, items }
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
