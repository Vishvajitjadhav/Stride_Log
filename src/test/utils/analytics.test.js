import { describe, it, expect } from 'vitest'
import { taskCompletion, tasksPerDay, categoryTotals, perEmployee } from '../../utils/analytics'

describe('taskCompletion', () => {
  it('handles empty list', () => {
    expect(taskCompletion([])).toEqual({ total: 0, done: 0, rate: 0 })
  })

  it('computes done count and rounded rate', () => {
    const tasks = [{ status: 'done' }, { status: 'done' }, { status: 'pending' }]
    expect(taskCompletion(tasks)).toEqual({ total: 3, done: 2, rate: 67 })
  })
})

describe('tasksPerDay', () => {
  it('groups tasks by date sorted ascending', () => {
    const logs = [
      { date: '2026-06-02', tasks: [{ status: 'done' }, { status: 'pending' }] },
      { date: '2026-06-01', tasks: [{ status: 'done' }] },
    ]
    expect(tasksPerDay(logs)).toEqual([
      { date: '2026-06-01', total: 1, done: 1 },
      { date: '2026-06-02', total: 2, done: 1 },
    ])
  })

  it('treats missing tasks as empty', () => {
    expect(tasksPerDay([{ date: '2026-06-01' }])).toEqual([{ date: '2026-06-01', total: 0, done: 0 }])
  })
})

describe('categoryTotals', () => {
  it('counts by category name, falls back to Uncategorized, sorted desc', () => {
    const tasks = [
      { categories: { name: 'Dev', color: '#111' } },
      { categories: { name: 'Dev', color: '#111' } },
      { categories: null },
    ]
    expect(categoryTotals(tasks)).toEqual([
      { name: 'Dev', color: '#111', count: 2 },
      { name: 'Uncategorized', color: '#9ca3af', count: 1 },
    ])
  })
})

describe('perEmployee', () => {
  it('rolls up per user with name lookup, sorted by done desc', () => {
    const logs = [
      { user_id: 'a', date: '2026-06-01', tasks: [{ status: 'done' }, { status: 'pending' }] },
      { user_id: 'a', date: '2026-06-02', tasks: [{ status: 'done' }] },
      { user_id: 'b', date: '2026-06-01', tasks: [{ status: 'done' }] },
    ]
    const profiles = { a: { name: 'Alice', avatar_initials: 'AL' }, b: { name: 'Bob' } }
    const result = perEmployee(logs, profiles)
    expect(result[0]).toEqual({ userId: 'a', name: 'Alice', avatar_initials: 'AL', total: 3, done: 2, rate: 67, days: 2 })
    expect(result[1]).toMatchObject({ userId: 'b', name: 'Bob', done: 1, days: 1 })
  })

  it('uses Unknown when profile missing', () => {
    const [row] = perEmployee([{ user_id: 'x', date: '2026-06-01', tasks: [] }], {})
    expect(row.name).toBe('Unknown')
  })
})
