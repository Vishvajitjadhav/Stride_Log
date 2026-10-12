// Productivity metrics: pure functions over the rows of v_task_facts and
// v_log_facts. Deliberately outcome based; there is no time tracking.
//
//   task   : { user_id, role, date, title, status, category, category_color,
//              assigned_by, due_date, completed_on, project_id, project }
//   log    : { user_id, role, date, submitted, blockers, summary }
//   person : { id, name, role, created_at }
//   project: { id, name, color, members: [{ user_id, role }] }
//
// A task belongs to the period of its `date` (the day it was planned for).

import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { isWorkingDay, workingDays, weekStartISO, addDaysISO, monthStartISO, monthEndISO } from './dates'

const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0)

export function inRange(rows, { from, to }) {
  return rows.filter(r => r.date >= from && r.date <= to)
}

// ── Expected working days ───────────────────────────────────────────────────

// First day we expect someone to log: their sign-up date, or earlier if they
// have (imported) history before that.
function startDates(people, logs) {
  const start = new Map()
  people.forEach(p => start.set(p.id, (p.created_at ?? '0000-00-00').slice(0, 10)))
  logs.forEach(l => {
    if (start.has(l.user_id) && l.date < start.get(l.user_id)) start.set(l.user_id, l.date)
  })
  return start
}

// Number of (person, working day) pairs where a log was expected.
export function expectedLogDays(people, logs, { from, to }, holidays, today) {
  const end = to < today ? to : today
  const days = workingDays(from, end, holidays)
  const start = startDates(people, logs)
  return people.reduce((n, p) => n + days.filter(d => d >= start.get(p.id)).length, 0)
}

// ── Summary KPIs ────────────────────────────────────────────────────────────

export function summarize({ tasks = [], logs = [], people = [], range, holidays = new Set(), today }) {
  const t = inRange(tasks, range)
  const l = inRange(logs, range)

  const done = t.filter(x => x.status === 'done')
  const carried = t.filter(x =>
    (x.status === 'done' && x.completed_on && x.completed_on > x.date) ||
    (x.status !== 'done' && x.date < today)
  )
  const assigned = t.filter(x => x.assigned_by)
  const assignedDue = assigned.filter(x => x.due_date && (x.status === 'done' || x.due_date < today))
  const onTime = assignedDue.filter(x => x.status === 'done' && x.completed_on && x.completed_on <= x.due_date)

  const submitted = l.filter(x => x.submitted)
  const workSubmitted = submitted.filter(x => isWorkingDay(x.date, holidays) && x.date <= today)
  const extraDays = submitted.filter(x => !isWorkingDay(x.date, holidays))
  const expected = expectedLogDays(people, l, range, holidays, today)

  return {
    planned: t.length,
    done: done.length,
    completionRate: pct(done.length, t.length),
    blocked: t.filter(x => x.status === 'blocked').length,
    carried: carried.length,
    assigned: assigned.length,
    onTimeRate: pct(onTime.length, assignedDue.length),
    onTimeBase: assignedDue.length,
    loggedDays: workSubmitted.length,
    expectedDays: expected,
    consistency: Math.min(100, pct(workSubmitted.length, expected)),
    extraDays: extraDays.length,
    activePeople: new Set([...t.map(x => x.user_id), ...submitted.map(x => x.user_id)]).size,
  }
}

// ── Growth vs previous period ───────────────────────────────────────────────

const COMPARE_KEYS = ['planned', 'done', 'completionRate', 'consistency', 'onTimeRate', 'carried', 'blocked', 'extraDays']

// -> { key: { value, prev, delta } }
export function compare(current, previous) {
  const out = {}
  COMPARE_KEYS.forEach(k => {
    const value = current?.[k] ?? 0
    const prev = previous?.[k] ?? 0
    out[k] = { value, prev, delta: value - prev }
  })
  return out
}

// ── Breakdowns ──────────────────────────────────────────────────────────────

export function perPerson({ tasks, logs, people, range, holidays, today }) {
  const byUser = (rows, id) => rows.filter(r => r.user_id === id)
  const t = inRange(tasks, range)
  const l = inRange(logs, range)
  return people
    .map(p => ({
      id: p.id,
      name: p.name,
      avatar_initials: p.avatar_initials,
      avatar_url: p.avatar_url,
      role: p.role,
      ...summarize({ tasks: byUser(t, p.id), logs: byUser(l, p.id), people: [p], range, holidays, today }),
    }))
    .sort((a, b) => b.done - a.done || b.consistency - a.consistency || a.name.localeCompare(b.name))
}

// Week buckets for periods up to ~3 months, month buckets for longer ones.
export function bucketSize(range) {
  return differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) > 95 ? 'month' : 'week'
}

function buckets(range, size, minWeeks) {
  const out = []
  if (size === 'month') {
    for (let m = monthStartISO(range.from); m <= range.to; m = addDaysISO(monthEndISO(m), 1)) {
      out.push({ from: m, to: monthEndISO(m), label: format(parseISO(m), 'MMM yyyy') })
    }
    return out
  }
  const last = weekStartISO(range.to)
  let first = weekStartISO(range.from)
  const minFirst = addDaysISO(last, -7 * (minWeeks - 1))
  if (first > minFirst) first = minFirst
  for (let w = first; w <= last; w = addDaysISO(w, 7)) {
    out.push({ from: w, to: addDaysISO(w, 6), label: format(parseISO(w), 'd MMM') })
  }
  return out
}

// One row per week (or month) with the main numbers. Short periods show at
// least `minWeeks` weeks so a trend is visible. Future buckets are dropped.
export function trend({ tasks, logs, people, range, holidays, today, minWeeks = 8 }) {
  const size = bucketSize(range)
  return buckets(range, size, minWeeks)
    .filter(b => b.from <= today)
    .map(b => {
      const s = summarize({ tasks, logs, people, range: b, holidays, today })
      return {
        ...b,
        size,
        planned: s.planned,
        done: s.done,
        completionRate: s.completionRate,
        consistency: s.consistency,
        loggedDays: s.loggedDays,
        expectedDays: s.expectedDays,
        blocked: s.blocked,
      }
    })
}

// -> [{ name, color, count, done }] desc by count
export function categoryMix(tasks = []) {
  const m = new Map()
  tasks.forEach(t => {
    const name = t.category ?? 'Uncategorized'
    if (!m.has(name)) m.set(name, { name, color: t.category_color ?? '#94a3b8', count: 0, done: 0 })
    const e = m.get(name)
    e.count++
    if (t.status === 'done') e.done++
  })
  return [...m.values()].sort((a, b) => b.count - a.count)
}

// Per project: members, people who actually worked on it, tasks and trend.
export function perProject({ tasks, projects = [], range, today, holidays }) {
  return projects.map(p => {
    const pt = tasks.filter(t => t.project_id === p.id)
    const inR = inRange(pt, range)
    const done = inR.filter(t => t.status === 'done').length
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      members: p.members.length,
      managers: p.members.filter(m => m.role === 'manager').length,
      activePeople: new Set(inR.map(t => t.user_id)).size,
      planned: inR.length,
      done,
      completionRate: pct(done, inR.length),
      blocked: inR.filter(t => t.status === 'blocked').length,
      trend: trend({ tasks: pt, logs: [], people: [], range, holidays, today }).map(b => ({ label: b.label, done: b.done, planned: b.planned })),
    }
  }).sort((a, b) => b.done - a.done || a.name.localeCompare(b.name))
}

// ── Plain-English observations ──────────────────────────────────────────────

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// A few short sentences a manager can read in seconds.
// against: wording for the comparison period, e.g. "last week".
export function observations({ current, previous, persons = [], categories = [], against = 'the previous period' }) {
  const out = []
  if (current.planned === 0) return ['No tasks were planned in this period.']

  if (previous && previous.planned === 0) {
    out.push(`There is no data from ${against} to compare with.`)
  } else if (previous && previous.done !== current.done) {
    const dir = current.done > previous.done ? 'rose' : 'fell'
    out.push(`Tasks completed ${dir} from ${previous.done} to ${current.done} compared with ${against}.`)
  } else if (previous) {
    out.push(`Tasks completed held steady at ${current.done} compared with ${against}.`)
  }

  if (persons.length === 1) {
    const p = persons[0]
    const missed = Math.max(0, p.expectedDays - p.loggedDays)
    out.push(`Finished ${p.completionRate}% of planned tasks.`)
    out.push(missed ? `Missed the daily log on ${plural(missed, 'working day')}.` : 'Submitted a daily log on every working day.')
  } else if (persons.length > 1) {
    const top = [...persons].filter(p => p.done > 0).sort((a, b) => b.done - a.done)[0]
    if (top) out.push(`${top.name} completed the most tasks (${top.done}, ${top.completionRate}% of planned).`)
    const missed = persons
      .map(p => ({ name: p.name, days: Math.max(0, p.expectedDays - p.loggedDays) }))
      .filter(p => p.days > 0)
      .sort((a, b) => b.days - a.days)
    if (missed.length === 0) {
      out.push('Everyone submitted a daily log on every working day.')
    } else {
      const names = missed.slice(0, 3).map(p => `${p.name} (${plural(p.days, 'day')})`).join(', ')
      const more = missed.length > 3 ? ` and ${missed.length - 3} more` : ''
      out.push(`Missed daily logs: ${names}${more}.`)
    }
  }

  const total = categories.reduce((n, c) => n + c.count, 0)
  if (categories[0] && total) {
    out.push(`Most work went to ${categories[0].name} (${Math.round((categories[0].count / total) * 100)}% of tasks).`)
  }

  if (current.blocked > 0) {
    out.push(`${plural(current.blocked, 'task is', 'tasks are')} blocked and may need help.`)
  }

  return out
}
