import { describe, it, expect } from 'vitest'
import { mapRows, parseDateCell, normalizeStatus } from '../../utils/importMap'

const MAP = { date: 'Date', title: 'Task', status: 'Status', category: 'Category', notes: 'Notes' }

describe('parseDateCell', () => {
  it('passes through ISO dates', () => {
    expect(parseDateCell('2026-05-15')).toBe('2026-05-15')
  })
  it('formats Date objects', () => {
    expect(parseDateCell(new Date(2026, 4, 15))).toBe('2026-05-15')
  })
  it('parses day-first slash dates', () => {
    expect(parseDateCell('15/05/2026')).toBe('2026-05-15')
  })
  it('returns null for junk', () => {
    expect(parseDateCell('not a date')).toBeNull()
    expect(parseDateCell('')).toBeNull()
    expect(parseDateCell(null)).toBeNull()
  })
})

describe('normalizeStatus', () => {
  it('maps done variants', () => {
    expect(normalizeStatus('Done')).toBe('done')
    expect(normalizeStatus('Completed')).toBe('done')
  })
  it('maps in-progress variants', () => {
    expect(normalizeStatus('In Progress')).toBe('in_progress')
    expect(normalizeStatus('WIP')).toBe('in_progress')
    expect(normalizeStatus('In Review')).toBe('in_review')
    expect(normalizeStatus('Ready for QA')).toBe('in_review')
  })
  it('defaults to pending', () => {
    expect(normalizeStatus('')).toBe('pending')
    expect(normalizeStatus('todo')).toBe('pending')
  })
})

describe('mapRows', () => {
  it('groups tasks by date and counts them', () => {
    const rows = [
      { Date: '2026-05-15', Task: 'Setup repo', Status: 'Done', Category: 'Development', Hours: '2' },
      { Date: '2026-05-15', Task: 'Standup', Status: 'Done', Category: 'Meeting' },
      { Date: '2026-05-16', Task: 'Write tests', Status: 'In Progress', Hours: '3.5' },
    ]
    const { days, taskCount, warnings } = mapRows(rows, MAP)
    expect(warnings).toHaveLength(0)
    expect(taskCount).toBe(3)
    expect(days).toHaveLength(2)
    expect(days[0]).toMatchObject({ date: '2026-05-15' })
    expect(days[0].tasks).toEqual([
      { title: 'Setup repo', status: 'done', category: 'Development' },
      { title: 'Standup', status: 'done', category: 'Meeting' },
    ])
    expect(days[1].tasks[0]).toMatchObject({ status: 'in_progress', category: null })
  })

  it('collects notes into what_i_did per day', () => {
    const rows = [
      { Date: '2026-05-15', Task: 'A', Notes: 'Made progress on auth' },
      { Date: '2026-05-15', Task: 'B', Notes: 'Made progress on auth' },
    ]
    const { days } = mapRows(rows, MAP)
    expect(days[0].what_i_did).toBe('Made progress on auth')
  })

  it('warns and skips rows with unreadable dates', () => {
    const rows = [{ Date: 'garbage', Task: 'X' }]
    const { days, warnings } = mapRows(rows, MAP)
    expect(days).toHaveLength(0)
    expect(warnings[0].message).toMatch(/date/i)
  })

  it('warns and skips rows with no title or note', () => {
    const rows = [{ Date: '2026-05-15', Task: '' }]
    const { warnings } = mapRows(rows, MAP)
    expect(warnings[0].message).toMatch(/title|note/i)
  })
})
