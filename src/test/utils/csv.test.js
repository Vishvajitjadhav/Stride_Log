import { describe, it, expect } from 'vitest'
import { toCSV } from '../../utils/csv'

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'task', label: 'Task' },
  { key: 'status', label: 'Status' },
]

describe('toCSV', () => {
  it('returns header only when no rows', () => {
    expect(toCSV([], columns)).toBe('Date,Task,Status')
  })

  it('renders header + rows', () => {
    const rows = [{ date: '2026-06-01', task: 'Build API', status: 'done' }]
    expect(toCSV(rows, columns)).toBe('Date,Task,Status\n2026-06-01,Build API,done')
  })

  it('escapes commas, quotes and newlines', () => {
    const rows = [{ date: '2026-06-01', task: 'Fix "login", urgent\nASAP', status: 'done' }]
    expect(toCSV(rows, columns)).toBe(
      'Date,Task,Status\n2026-06-01,"Fix ""login"", urgent\nASAP",done'
    )
  })

  it('renders empty string for null/undefined values', () => {
    const rows = [{ date: '2026-06-01', task: null, status: undefined }]
    expect(toCSV(rows, columns)).toBe('Date,Task,Status\n2026-06-01,,')
  })
})
