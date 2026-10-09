import { describe, it, expect } from 'vitest'
import { observations } from '../../utils/metrics'
import { shapeReport } from '../../components/reports/buildReport'
import { formatRange } from '../../utils/dates'

const DASH = /[–—]/

describe('observations', () => {
  const base = { planned: 10, done: 8, blocked: 0 }
  it('describes the trend, top performer, missed logs and main category in plain words', () => {
    const out = observations({
      current: { ...base, blocked: 2 },
      previous: { planned: 9, done: 5 },
      persons: [
        { name: 'Ana', done: 6, completionRate: 86, expectedDays: 5, loggedDays: 5 },
        { name: 'Raj', done: 2, completionRate: 67, expectedDays: 5, loggedDays: 3 },
      ],
      categories: [{ name: 'Development', count: 6 }, { name: 'Design', count: 4 }],
      periodName: 'week',
    })
    expect(out).toEqual([
      'Tasks completed rose from 5 to 8 compared with the previous week.',
      'Ana completed the most tasks (6, 86% of planned).',
      'Missed daily logs: Raj (2 days).',
      'Most work went to Development (60% of tasks).',
      '2 tasks are blocked and may need help.',
    ])
    out.forEach(line => expect(line).not.toMatch(DASH))
  })

  it('praises full log consistency and handles empty periods', () => {
    expect(observations({ current: base, persons: [{ name: 'A', done: 1, completionRate: 50, expectedDays: 2, loggedDays: 2 }] }))
      .toContain('Everyone submitted a daily log on every working day.')
    expect(observations({ current: { planned: 0, done: 0, blocked: 0 } })).toEqual(['No tasks were planned in this period.'])
  })
})

describe('formatRange', () => {
  it('uses "to" instead of a dash', () => {
    expect(formatRange('2026-10-05', '2026-10-11')).toBe('5 Oct to 11 Oct 2026')
    expect(formatRange('2025-12-29', '2026-01-04')).toBe('29 Dec 2025 to 4 Jan 2026')
  })
})

describe('shapeReport', () => {
  const people = [
    { id: 'a', name: 'Ana', role: 'employee', team_id: 't1', created_at: '2026-01-01' },
    { id: 'b', name: 'Ben', role: 'ba', team_id: null, created_at: '2026-01-01' },
  ]
  const task = o => ({ user_id: 'a', team_id: 't1', role: 'employee', status: 'done', category: 'Development', assigned_by: null, due_date: null, completed_on: o.date, ...o })
  const input = {
    kind: 'weekly',
    range: { from: '2026-10-05', to: '2026-10-11' },
    scope: { kind: 'all' },
    org: { company_name: 'Acme' },
    people,
    allProfiles: [...people, { id: 'm', name: 'Maya Manager' }],
    teams: [{ id: 't1', name: 'Engineering' }],
    holidayRows: [{ date: '2026-10-06', name: 'Founders Day' }],
    tasks: [
      task({ id: 1, date: '2026-10-05', title: 'Build login' }),
      task({ id: 2, date: '2026-10-05', title: 'Fix bug', status: 'blocked', completed_on: null, assigned_by: 'm' }),
      task({ id: 3, date: '2026-10-07', title: 'Review PR' }),
      task({ id: 4, date: '2026-10-10', title: 'Weekend deploy' }),
    ],
    logs: [
      { user_id: 'a', date: '2026-10-05', submitted: true, blockers: 'Waiting on API', summary: 'Login done' },
      { user_id: 'a', date: '2026-10-10', submitted: true, blockers: null, summary: null },
    ],
    generatedBy: 'Maya Manager',
    today: '2026-10-12',
  }
  const r = shapeReport(input)
  const ana = r.details.find(d => d.name === 'Ana')

  it('builds a day by day table per employee with tasks, state and notes', () => {
    expect(r.scope.name).toBe('All employees')
    expect(r.details.map(d => d.name)).toEqual(['Ana', 'Ben'])
    const mon = ana.days.find(d => d.date === '2026-10-05')
    expect(mon).toMatchObject({ state: 'Submitted', summary: 'Login done', blockers: 'Waiting on API' })
    expect(mon.tasks.map(t => t.title)).toEqual(['Build login', 'Fix bug'])
    expect(mon.tasks[1].assignedBy).toBe('Maya Manager')
    expect(ana.days.find(d => d.date === '2026-10-06').state).toBe('Holiday: Founders Day')
    expect(ana.days.find(d => d.date === '2026-10-07').state).toBe('Not submitted')
    expect(ana.days.find(d => d.date === '2026-10-10').state).toBe('Extra day')
    // Sunday with no work is left out
    expect(ana.days.find(d => d.date === '2026-10-11')).toBeUndefined()
    expect(ana.team).toBe('Engineering')
  })

  it('computes summary numbers and observations without dashes', () => {
    expect(r.current).toMatchObject({ planned: 4, done: 3, blocked: 1 })
    expect(r.observations.length).toBeGreaterThan(0)
    r.observations.forEach(o => expect(o).not.toMatch(DASH))
  })

  it('gives week by week rows for monthly reports', () => {
    const m = shapeReport({ ...input, kind: 'monthly', range: { from: '2026-10-01', to: '2026-10-31' } })
    const a = m.details.find(d => d.name === 'Ana')
    expect(a.days).toBeNull()
    expect(a.weeks[0]).toMatchObject({ from: '2026-10-01', to: '2026-10-04' })
    expect(a.weeks.find(w => w.from === '2026-10-05')).toMatchObject({ planned: 4, done: 3 })
    expect(a.open.map(t => t.title)).toEqual(['Fix bug'])
  })
})
