import { describe, it, expect } from 'vitest'
import { statusCounts, lastWeeks, weeklyDone, trendLabel, attention, insights } from '../../utils/insights'

describe('insights', () => {
  it('counts tasks per status', () => {
    expect(statusCounts([{ status: 'done' }, { status: 'in_review' }, { status: 'odd' }]))
      .toEqual({ pending: 1, in_progress: 0, in_review: 1, done: 1, blocked: 0 })
  })

  it('buckets finished tasks into the last weeks', () => {
    const weeks = lastWeeks('2026-10-28', 3)
    expect(weeks).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
    expect(weeklyDone([
      { status: 'done', date: '2026-10-10', completed_on: '2026-10-13' },
      { status: 'done', date: '2026-10-27' },
      { status: 'pending', date: '2026-10-27' },
    ], weeks)).toEqual([1, 0, 1])
  })

  it('labels a trend against the same person only', () => {
    expect(trendLabel([2, 2, 2, 4, 4, 4])).toBe('up')
    expect(trendLabel([5, 5, 5, 2, 3, 2])).toBe('down')
    expect(trendLabel([3, 4, 3, 3, 3, 4])).toBe('steady')
    expect(trendLabel([0, 0, 0, 0, 0, 0])).toBe('new')
    expect(trendLabel([1, 2])).toBe('new')
    // A new joiner has no earlier weeks to compare with.
    expect(trendLabel([0, 0, 0, 3, 4, 5])).toBe('new')
    // A tiny change on tiny numbers is not a trend.
    expect(trendLabel([1, 0, 1, 1, 1, 1])).toBe('steady')
  })

  it('finds open work that needs attention', () => {
    const today = '2026-10-28'
    expect(attention([
      { status: 'blocked' },
      { status: 'pending', due_date: '2026-10-27', changed_at: '2026-10-28T10:00:00Z' },
      { status: 'in_progress', changed_at: '2026-10-19T10:00:00Z' },
      { status: 'done', due_date: '2026-10-01', changed_at: '2026-10-01T10:00:00Z' },
    ], today)).toEqual({ blocked: 1, overdue: 1, stuck: 1, total: 3 })
  })

  it('writes short sentences, most important first', () => {
    const out = insights({
      current: { planned: 20, done: 15, completionRate: 75 },
      previous: { planned: 18, done: 12 },
      against: 'last week',
      persons: [{ name: 'Arjun', trend: 'up' }, { name: 'Sara', trend: 'down' }, { name: 'Liam', trend: 'steady' }],
      projects: [{ name: 'Billing', done: 9, planned: 10, completionRate: 90 }, { name: 'App', done: 6, planned: 10, completionRate: 60 }],
      att: { blocked: 1, overdue: 0, stuck: 2, total: 3 },
    })
    expect(out).toEqual([
      '15 tasks finished, 3 more than last week.',
      '75% of planned work is done (15 of 20).',
      'Billing moved the most: 9 tasks done, 90% of its planned work.',
      'Improving on their own recent weeks: Arjun.',
      'Finishing less than their recent weeks: Sara.',
      '3 items need attention: 1 blocked, 2 with no change for 5 working days.',
    ])
  })
})
