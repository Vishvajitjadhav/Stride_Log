import { describe, it, expect } from 'vitest'
import { boardCards, columnOf, workingDaysSince, sortCards } from '../../utils/board'

const today = '2026-10-28' // Wednesday
const task = (id, extra) => ({
  id, user_id: 'u1', date: '2026-10-28', title: `Task ${id}`, status: 'pending', due_date: null, completed_on: null,
  project_id: null, project: null, source: 'manual', external_url: null, external_id: null, changed_at: '2026-10-28T09:00:00Z', ...extra,
})

describe('board rules', () => {
  it('puts blocked work with In progress', () => {
    expect(columnOf('blocked')).toBe('in_progress')
    expect(columnOf('in_review')).toBe('in_review')
    expect(columnOf('weird')).toBe('pending')
  })

  it('counts working days since a change, skipping weekends and holidays', () => {
    expect(workingDaysSince('2026-10-28', today)).toBe(0)
    expect(workingDaysSince('2026-10-23', today)).toBe(3)            // Fri -> Mon, Tue, Wed
    expect(workingDaysSince('2026-10-23', today, new Set(['2026-10-27']))).toBe(2)
  })

  it('shows open work from the last 30 days and done work finished in the period', () => {
    const cards = boardCards({
      tasks: [
        task('open-recent', { date: '2026-10-20' }),
        task('open-ancient', { date: '2026-08-01' }),
        task('done-in', { status: 'done', date: '2026-10-20', completed_on: '2026-10-28' }),
        task('done-before', { status: 'done', date: '2026-10-20', completed_on: '2026-10-27' }),
      ],
      from: today, to: today, today,
    })
    expect(cards.map(c => c.id)).toEqual(['open-recent', 'done-in'])
  })

  it('flags stuck, overdue and blocked open work, never done work', () => {
    const [stuck, overdue, blocked, done] = boardCards({
      tasks: [
        task('a', { changed_at: '2026-10-20T10:00:00Z' }),
        task('b', { due_date: '2026-10-27' }),
        task('c', { status: 'blocked' }),
        task('d', { status: 'done', completed_on: today, changed_at: '2026-10-01T10:00:00Z', due_date: '2026-10-01' }),
      ],
      from: today, to: today, today,
    })
    expect(stuck).toMatchObject({ stuck: true, changedDays: 6 })
    expect(overdue).toMatchObject({ overdue: true, stuck: false })
    expect(blocked).toMatchObject({ blocked: true, column: 'in_progress' })
    expect(done).toMatchObject({ stuck: false, overdue: false })
    expect(sortCards([overdue, stuck, blocked]).map(c => c.id)).toEqual(['c', 'a', 'b'])
  })

  it('turns unowned Jira issues into cards', () => {
    const [card] = boardCards({
      issues: [{ key: 'APP-7', title: 'Set up alerts', status: 'pending', status_name: 'To Do', jira_project: 'Mobile App', project_id: 'p1',
        assignee_name: null, url: 'https://x/browse/APP-7', due_date: null, updated_at: '2026-10-28T08:00:00Z' }],
      from: today, to: today, today,
    })
    expect(card).toMatchObject({ id: 'jira:APP-7', kind: 'issue', userId: null, source: 'jira', projectId: 'p1', column: 'pending' })
  })
})
