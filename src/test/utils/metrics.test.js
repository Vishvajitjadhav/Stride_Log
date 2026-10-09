import { describe, it, expect } from 'vitest'
import {
  applyFilters, summarize, compare, perPerson, perTeam, weeklyTrend, categoryMix,
  blockerFeed, notLoggedOn, expectedLogDays, dailySeries,
} from '../../utils/metrics'
import { presetRange, previousRange, workingDays, isWorkingDay, daysAgoISO } from '../../utils/dates'

// Week of Mon 2026-10-05 .. Sun 2026-10-11; "today" = Thu 2026-10-08
const range = { from: '2026-10-05', to: '2026-10-11' }
const today = '2026-10-08'
const ana = { id: 'a', name: 'Ana', team_id: 't1', role: 'employee', created_at: '2026-01-01T00:00:00Z' }
const raj = { id: 'r', name: 'Raj', team_id: 't2', role: 'ba', created_at: '2026-10-07T00:00:00Z' }
const people = [ana, raj]
const holidays = new Set(['2026-10-06'])

const task = (o) => ({ user_id: 'a', team_id: 't1', role: 'employee', status: 'pending', category: 'Development', category_color: '#7c3aed', assigned_by: null, due_date: null, completed_on: null, ...o })
const log = (o) => ({ user_id: 'a', team_id: 't1', role: 'employee', submitted: true, blockers: null, ...o })

const tasks = [
  task({ date: '2026-10-05', status: 'done', completed_on: '2026-10-05' }),
  task({ date: '2026-10-05', status: 'done', completed_on: '2026-10-07' }),                 // carried, done later
  task({ date: '2026-10-07', status: 'pending' }),                                          // carried (open, past)
  task({ date: '2026-10-08', title: 'Interview panel', status: 'blocked', category: 'Interview', category_color: '#06b6d4' }),
  task({ date: '2026-10-07', status: 'done', completed_on: '2026-10-07', assigned_by: 'm', due_date: '2026-10-07' }), // on time
  task({ date: '2026-10-07', status: 'pending', assigned_by: 'm', due_date: '2026-10-07' }),                          // overdue
  task({ user_id: 'r', team_id: 't2', role: 'ba', date: '2026-10-08', status: 'done', completed_on: '2026-10-08' }),
  task({ date: '2026-09-28', status: 'done', completed_on: '2026-09-28' }),                 // previous week
]
const logs = [
  log({ date: '2026-10-05' }),
  log({ date: '2026-10-07', blockers: 'Waiting on API keys' }),
  log({ date: '2026-10-04' }),                                   // Sunday: extra day (previous week)
  log({ date: '2026-10-06' }),                                   // holiday: extra day
  log({ user_id: 'r', team_id: 't2', role: 'ba', date: '2026-10-08' }),
  log({ date: '2026-09-29' }),
]

describe('dates helpers', () => {
  it('presets resolve to Monday-based weeks and calendar months', () => {
    const ref = new Date('2026-10-08T10:00:00')
    expect(presetRange('this_week', ref)).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(presetRange('last_week', ref)).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(presetRange('last_month', ref)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(presetRange('this_quarter', ref)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
  })
  it('previousRange is the equally long period right before', () => {
    expect(previousRange(range)).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(previousRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
  })
  it('working days are Mon–Fri minus holidays', () => {
    expect(workingDays(range.from, range.to, holidays)).toEqual(['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09'])
    expect(isWorkingDay('2026-10-10')).toBe(false)
  })
  it('daysAgoISO uses the local calendar', () => {
    expect(daysAgoISO(3, new Date('2026-10-08T01:00:00'))).toBe('2026-10-05')
  })
})

describe('summarize', () => {
  const s = summarize({ tasks, logs, people, range, holidays, today })

  it('counts planned / done / completion for tasks dated in range', () => {
    expect(s.planned).toBe(7)
    expect(s.done).toBe(4)
    expect(s.completionRate).toBe(57)
    expect(s.blocked).toBe(1)
  })
  it('counts carried-over work (finished late or still open from an earlier day)', () => {
    // done-late, open 10-07 pending, overdue assigned 10-07 pending
    expect(s.carried).toBe(3)
  })
  it('measures assigned tasks done on time', () => {
    expect(s.assigned).toBe(2)
    expect(s.onTimeBase).toBe(2)
    expect(s.onTimeRate).toBe(50)
  })
  it('consistency counts only elapsed working days since each person started', () => {
    // Ana: 10-05, 10-07, 10-08 expected (holiday 10-06 skipped) => 3; Raj started 10-07 => 2
    expect(s.expectedDays).toBe(5)
    expect(s.loggedDays).toBe(3)          // Ana 10-05, 10-07; Raj 10-08
    expect(s.consistency).toBe(60)
  })
  it('holiday / weekend logs are extra days, never penalised', () => {
    expect(s.extraDays).toBe(1)           // 10-06 holiday
  })
  it('blockers include blocked tasks and blocker notes', () => {
    expect(s.blockersRaised).toBe(2)
  })
})

describe('compare', () => {
  it('reports delta and % change vs previous', () => {
    const c = compare({ done: 6, completionRate: 50 }, { done: 4, completionRate: 60 })
    expect(c.done).toMatchObject({ value: 6, prev: 4, delta: 2, deltaPct: 50 })
    expect(c.completionRate.delta).toBe(-10)
    expect(compare({ done: 3 }, { done: 0 }).done.deltaPct).toBeNull()
  })
})

describe('breakdowns', () => {
  it('applyFilters narrows by team, category, status and source', () => {
    expect(applyFilters({ tasks, logs }, { team: 't2' }).tasks).toHaveLength(1)
    expect(applyFilters({ tasks, logs }, { category: 'Interview' }).tasks).toHaveLength(1)
    expect(applyFilters({ tasks, logs }, { source: 'assigned' }).tasks).toHaveLength(2)
    expect(applyFilters({ tasks, logs }, { status: 'done', person: 'a' }).tasks).toHaveLength(4)
    expect(applyFilters({ tasks, logs }, { team: 'all' }).logs).toHaveLength(logs.length)
  })
  it('perPerson ranks by tasks done', () => {
    const rows = perPerson({ tasks, logs, people, range, holidays, today })
    expect(rows.map(r => r.name)).toEqual(['Ana', 'Raj'])
    expect(rows[1]).toMatchObject({ done: 1, planned: 1, consistency: 50 })
  })
  it('perTeam groups people by team and drops empty groups', () => {
    const rows = perTeam({ tasks, logs, people, teams: [{ id: 't1', name: 'Web' }, { id: 't2', name: 'Biz' }, { id: 't3', name: 'Empty' }], range, holidays, today })
    expect(rows.map(r => r.name)).toEqual(['Web', 'Biz'])
  })
  it('weeklyTrend covers at least 8 weeks and stops at today', () => {
    const t = weeklyTrend({ tasks, logs, people, range, holidays, today })
    expect(t).toHaveLength(8)
    expect(t.at(-1)).toMatchObject({ week: '2026-10-05', done: 4 })
    expect(t.at(-2)).toMatchObject({ week: '2026-09-28', done: 1 })
  })
  it('dailySeries has one row per day', () => {
    const d = dailySeries(tasks, range)
    expect(d).toHaveLength(7)
    expect(d[0]).toEqual({ date: '2026-10-05', planned: 2, done: 2 })
  })
  it('categoryMix sorts by count', () => {
    expect(categoryMix(tasks)[0]).toMatchObject({ name: 'Development', count: 7 })
  })
  it('blockerFeed lists newest first with names', () => {
    const f = blockerFeed({ tasks, logs, range, peopleById: { a: ana } })
    expect(f.map(b => b.text)).toEqual(['Interview panel', 'Waiting on API keys'])
    expect(f[0].name).toBe('Ana')
  })
  it('notLoggedOn ignores non-working days', () => {
    expect(notLoggedOn('2026-10-08', people, logs).map(p => p.id)).toEqual(['a'])
    expect(notLoggedOn('2026-10-10', people, logs)).toEqual([])
  })
  it('expectedLogDays never counts future days', () => {
    expect(expectedLogDays([ana], [], { from: '2026-10-05', to: '2026-10-31' }, new Set(), '2026-10-05')).toBe(1)
  })
})
