// Productivity metrics — pure functions over the rows of v_task_facts and
// v_log_facts. Deliberately outcome based: there is no time tracking.
//
//   task  : { user_id, team_id, role, date, title, status, category, category_color,
//             assigned_by, due_date, completed_on }
//   log   : { user_id, team_id, role, date, submitted, blockers }
//   person: { id, name, team_id, role, created_at }
//
// A task belongs to the period of its `date` (the day it was planned for).

import { format, parseISO } from 'date-fns'
import { isWorkingDay, workingDays, weekStartISO, addDaysISO, daysBetween } from './dates'

const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0)

// ── Filtering ───────────────────────────────────────────────────────────────

// filters: { team, person, role, category, status, source } — 'all'/'' = no filter
export function applyFilters({ tasks = [], logs = [] }, f = {}) {
  const on = v => v && v !== 'all'
  const personOk = r =>
    (!on(f.team) || r.team_id === f.team) &&
    (!on(f.person) || r.user_id === f.person) &&
    (!on(f.role) || r.role === f.role)

  return {
    tasks: tasks.filter(t =>
      personOk(t) &&
      (!on(f.category) || (t.category ?? 'Uncategorized') === f.category) &&
      (!on(f.status) || t.status === f.status) &&
      (!on(f.source) || (f.source === 'assigned' ? Boolean(t.assigned_by) : !t.assigned_by))
    ),
    logs: logs.filter(personOk),
  }
}

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
    inProgress: t.filter(x => x.status === 'in_progress').length,
    blocked: t.filter(x => x.status === 'blocked').length,
    carried: carried.length,
    assigned: assigned.length,
    assignedDone: assigned.filter(x => x.status === 'done').length,
    onTimeRate: pct(onTime.length, assignedDue.length),
    onTimeBase: assignedDue.length,
    loggedDays: workSubmitted.length,
    expectedDays: expected,
    consistency: Math.min(100, pct(workSubmitted.length, expected)),
    extraDays: extraDays.length,
    blockersRaised: l.filter(x => x.blockers).length + t.filter(x => x.status === 'blocked').length,
    activePeople: new Set([...t.map(x => x.user_id), ...submitted.map(x => x.user_id)]).size,
  }
}

// ── Growth vs previous period ───────────────────────────────────────────────

const COMPARE_KEYS = ['planned', 'done', 'completionRate', 'consistency', 'onTimeRate', 'carried', 'blocked', 'extraDays']

// -> { key: { value, prev, delta, deltaPct } }
export function compare(current, previous) {
  const out = {}
  COMPARE_KEYS.forEach(k => {
    const value = current?.[k] ?? 0
    const prev = previous?.[k] ?? 0
    out[k] = {
      value,
      prev,
      delta: value - prev,
      deltaPct: prev ? Math.round(((value - prev) / prev) * 100) : null,
    }
  })
  return out
}

// ── Breakdowns ──────────────────────────────────────────────────────────────

function groupBy(rows, key) {
  const m = new Map()
  rows.forEach(r => {
    const k = r[key] ?? null
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  })
  return m
}

export function perPerson({ tasks, logs, people, range, holidays, today }) {
  const tBy = groupBy(inRange(tasks, range), 'user_id')
  const lBy = groupBy(inRange(logs, range), 'user_id')
  return people
    .map(p => ({
      id: p.id,
      name: p.name,
      avatar_initials: p.avatar_initials,
      role: p.role,
      team_id: p.team_id,
      ...summarize({ tasks: tBy.get(p.id) ?? [], logs: lBy.get(p.id) ?? [], people: [p], range, holidays, today }),
    }))
    .sort((a, b) => b.done - a.done || b.consistency - a.consistency || a.name.localeCompare(b.name))
}

export function perTeam({ tasks, logs, people, teams = [], range, holidays, today }) {
  const groups = [...teams.map(t => ({ id: t.id, name: t.name })), { id: null, name: 'No team' }]
  return groups
    .map(g => {
      const members = people.filter(p => (p.team_id ?? null) === g.id)
      const ids = new Set(members.map(m => m.id))
      return {
        id: g.id,
        name: g.name,
        members: members.length,
        ...summarize({
          tasks: tasks.filter(t => ids.has(t.user_id)),
          logs: logs.filter(l => ids.has(l.user_id)),
          people: members, range, holidays, today,
        }),
      }
    })
    .filter(g => g.members > 0)
}

// Weekly buckets ending with the week containing range.to; at least `minWeeks`.
export function weeklyTrend({ tasks, logs, people, range, holidays, today, minWeeks = 8 }) {
  const lastWeek = weekStartISO(range.to)
  let first = weekStartISO(range.from)
  const minFirst = addDaysISO(lastWeek, -7 * (minWeeks - 1))
  if (first > minFirst) first = minFirst

  const out = []
  for (let ws = first; ws <= lastWeek; ws = addDaysISO(ws, 7)) {
    const r = { from: ws, to: addDaysISO(ws, 6) }
    if (r.from > today) break
    const s = summarize({ tasks, logs, people, range: r, holidays, today })
    out.push({
      week: ws,
      label: format(parseISO(ws), 'd MMM'),
      planned: s.planned,
      done: s.done,
      completionRate: s.completionRate,
      consistency: s.consistency,
    })
  }
  return out
}

// Per-day counts inside the range (for short ranges).
export function dailySeries(tasks, range) {
  const byDate = groupBy(inRange(tasks, range), 'date')
  return daysBetween(range.from, range.to).map(d => {
    const rows = byDate.get(d) ?? []
    return { date: d, planned: rows.length, done: rows.filter(r => r.status === 'done').length }
  })
}

// -> [{ name, color, count, done }] desc by count
export function categoryMix(tasks = []) {
  const m = new Map()
  tasks.forEach(t => {
    const name = t.category ?? 'Uncategorized'
    if (!m.has(name)) m.set(name, { name, color: t.category_color ?? '#9ca3af', count: 0, done: 0 })
    const e = m.get(name)
    e.count++
    if (t.status === 'done') e.done++
  })
  return [...m.values()].sort((a, b) => b.count - a.count)
}

// Most recent blockers first: blocked tasks + blocker notes on daily logs.
export function blockerFeed({ tasks = [], logs = [], range, peopleById = {} }, limit = 20) {
  const items = [
    ...inRange(tasks, range).filter(t => t.status === 'blocked').map(t => ({
      date: t.date, user_id: t.user_id, text: t.title, kind: 'task',
    })),
    ...inRange(logs, range).filter(l => l.blockers).map(l => ({
      date: l.date, user_id: l.user_id, text: l.blockers, kind: 'note',
    })),
  ]
  return items
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map(i => ({ ...i, name: peopleById[i.user_id]?.name ?? 'Unknown' }))
}

// Who has not submitted a log for `day` (working day only).
export function notLoggedOn(day, people, logs, holidays = new Set()) {
  if (!isWorkingDay(day, holidays)) return []
  const ok = new Set(logs.filter(l => l.date === day && l.submitted).map(l => l.user_id))
  return people.filter(p => !ok.has(p.id))
}

// ── Plain-English observations ──────────────────────────────────────────────

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// A few short sentences a manager can read in seconds.
// periodName: 'week' | 'month' | 'period' (used as "last week" etc.)
export function observations({ current, previous, persons = [], categories = [], periodName = 'period' }) {
  const out = []
  const prevLabel = `the previous ${periodName}`

  if (current.planned === 0) return ['No tasks were planned in this period.']

  if (previous && previous.done !== current.done) {
    const dir = current.done > previous.done ? 'rose' : 'fell'
    out.push(`Tasks completed ${dir} from ${previous.done} to ${current.done} compared with ${prevLabel}.`)
  } else if (previous) {
    out.push(`Tasks completed held steady at ${current.done} compared with ${prevLabel}.`)
  }

  const top = [...persons].filter(p => p.done > 0).sort((a, b) => b.done - a.done)[0]
  if (top && persons.length > 1) {
    out.push(`${top.name} completed the most tasks (${top.done}, ${top.completionRate}% of planned).`)
  }

  if (persons.length) {
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
