import { describe, it, expect } from 'vitest'
import {
  summarize, compare, perPerson, perProject, trend, bucketSize, categoryMix, expectedLogDays,
} from '../../utils/metrics'
import { presetRange, previousRange, workingDays, isWorkingDay } from '../../utils/dates'

// Week of Mon 2026-10-05 .. Sun 2026-10-11; "today" = Thu 2026-10-08
const range = { from: '2026-10-05', to: '2026-10-11' }
const today = '2026-10-08'
const ana = { id: 'a', name: 'Ana', role: 'employee', created_at: '2026-01-01T00:00:00Z' }
const raj = { id: 'r', name: 'Raj', role: 'ba', created_at: '2026-10-07T00:00:00Z' }
const people = [ana, raj]
const holidays = new Set(['2026-10-06'])

const task = (o) => ({ user_id: 'a', role: 'employee', status: 'pending', category: 'Development', category_color: '#2f4e7e', assigned_by: null, due_date: null, completed_on: null, project_id: 'p1', ...o })
const log = (o) => ({ user_id: 'a', role: 'employee', submitted: true, blockers: null, ...o })

const tasks = [
  task({ date: '2026-10-05', status: 'done', completed_on: '2026-10-05' }),
  task({ date: '2026-10-05', status: 'done', completed_on: '2026-10-07' }),                 // carried, done later
  task({ date: '2026-10-07', status: 'pending' }),                                          // carried (open, past)
  task({ date: '2026-10-08', title: 'Interview panel', status: 'blocked', category: 'Interview', project_id: 'p2' }),
  task({ date: '2026-10-07', status: 'done', completed_on: '2026-10-07', assigned_by: 'm', due_date: '2026-10-07' }), // on time
  task({ date: '2026-10-07', status: 'pending', assigned_by: 'm', due_date: '2026-10-07' }),                          // overdue
  task({ user_id: 'r', role: 'ba', date: '2026-10-08', status: 'done', completed_on: '2026-10-08', project_id: 'p2' }),
  task({ date: '2026-09-28', status: 'done', completed_on: '2026-09-28' }),                 // previous week
]
const logs = [
  log({ date: '2026-10-05' }),
  log({ date: '2026-10-07', blockers: 'Waiting on API keys' }),
  log({ date: '2026-10-04' }),                                   // Sunday: extra day (previous week)
  log({ date: '2026-10-06' }),                                   // holiday: extra day
  log({ user_id: 'r', role: 'ba', date: '2026-10-08' }),
  log({ date: '2026-09-29' }),
]

describe('dates helpers', () => {
  it('presets resolve to Monday-based weeks and calendar months', () => {
    const ref = new Date('2026-10-08T10:00:00')
    expect(presetRange('this_week', ref)).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(presetRange('last_week', ref)).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(presetRange('last_month', ref)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
  it('previousRange is the equally long period right before', () => {
    expect(previousRange(range)).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(previousRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
  })
  it('working days are Mon to Fri minus holidays', () => {
    expect(workingDays(range.from, range.to, holidays)).toEqual(['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09'])
    expect(isWorkingDay('2026-10-10')).toBe(false)
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
    expect(s.carried).toBe(3)
  })
  it('measures assigned tasks done on time', () => {
    expect(s.assigned).toBe(2)
    expect(s.onTimeBase).toBe(2)
    expect(s.onTimeRate).toBe(50)
  })
  it('consistency counts only elapsed working days since each person started', () => {
    expect(s.expectedDays).toBe(5)
    expect(s.loggedDays).toBe(3)
    expect(s.consistency).toBe(60)
  })
  it('holiday / weekend logs are extra days, never penalised', () => {
    expect(s.extraDays).toBe(1)
  })
})

describe('compare', () => {
  it('reports the change vs previous', () => {
    const c = compare({ done: 6, completionRate: 50 }, { done: 4, completionRate: 60 })
    expect(c.done).toEqual({ value: 6, prev: 4, delta: 2 })
    expect(c.completionRate.delta).toBe(-10)
  })
})

describe('breakdowns', () => {
  it('perPerson ranks by tasks done', () => {
    const rows = perPerson({ tasks, logs, people, range, holidays, today })
    expect(rows.map(r => r.name)).toEqual(['Ana', 'Raj'])
    expect(rows[1]).toMatchObject({ done: 1, planned: 1, consistency: 50 })
  })
  it('trend uses weeks for short periods (at least 8) and stops at today', () => {
    const t = trend({ tasks, logs, people, range, holidays, today })
    expect(t).toHaveLength(8)
    expect(t.at(-1)).toMatchObject({ from: '2026-10-05', done: 4, size: 'week' })
    expect(t.at(-2)).toMatchObject({ from: '2026-09-28', done: 1 })
  })
  it('trend switches to months for long periods', () => {
    const long = { from: '2026-01-01', to: '2026-12-31' }
    expect(bucketSize(long)).toBe('month')
    const t = trend({ tasks, logs, people, range: long, holidays, today })
    expect(t.map(b => b.label).slice(-2)).toEqual(['Sep 2026', 'Oct 2026'])
    expect(t.at(-1)).toMatchObject({ from: '2026-10-01', to: '2026-10-31', done: 4 })
  })
  it('perProject counts members, active people and tasks per project', () => {
    const projects = [
      { id: 'p1', name: 'Web', color: '#000', members: [{ user_id: 'a', role: 'member' }, { user_id: 'm', role: 'manager' }] },
      { id: 'p2', name: 'Mobile', color: '#111', members: [{ user_id: 'a', role: 'member' }, { user_id: 'r', role: 'member' }] },
    ]
    const rows = perProject({ tasks, projects, range, holidays, today })
    expect(rows.find(p => p.name === 'Web')).toMatchObject({ members: 2, managers: 1, activePeople: 1, planned: 5, done: 3 })
    expect(rows.find(p => p.name === 'Mobile')).toMatchObject({ activePeople: 2, planned: 2, done: 1, blocked: 1 })
  })
  it('categoryMix sorts by count', () => {
    expect(categoryMix(tasks)[0]).toMatchObject({ name: 'Development', count: 7 })
  })
  it('expectedLogDays never counts future days', () => {
    expect(expectedLogDays([ana], [], { from: '2026-10-05', to: '2026-10-31' }, new Set(), '2026-10-05')).toBe(1)
  })
})
