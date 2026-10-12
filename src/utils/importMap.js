// Pure mapping from spreadsheet rows -> StrideLog work logs + tasks.
// The page (ImportData.jsx) handles file reading & DB writes; this module
// only transforms + validates, so it's fully unit tested.

import { format, isValid, parse } from 'date-fns'

const DATE_FORMATS = ['dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy', 'dd MMM yyyy', 'dd MMMM yyyy', 'MM/dd/yyyy']

export function parseDateCell(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return isValid(value) ? format(value, 'yyyy-MM-dd') : null

  const str = String(value).trim()

  // ISO (possibly with a time component)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = parse(str.slice(0, 10), 'yyyy-MM-dd', new Date())
    return isValid(d) ? format(d, 'yyyy-MM-dd') : null
  }

  for (const fmt of DATE_FORMATS) {
    const d = parse(str, fmt, new Date())
    if (isValid(d)) return format(d, 'yyyy-MM-dd')
  }
  return null
}

export function normalizeStatus(value) {
  const s = String(value ?? '').trim().toLowerCase()
  if (!s) return 'pending'
  if (s.includes('done') || s.includes('complete') || s.includes('finish') || s === 'yes' || s === 'y' || s === '✓') {
    return 'done'
  }
  if (s.includes('progress') || s.includes('wip') || s.includes('ongoing') || s.includes('doing')) {
    return 'in_progress'
  }
  if (s.includes('block') || s.includes('stuck')) return 'blocked'
  return 'pending'
}

// rawRows: array of objects keyed by sheet header
// map: { date, title, status, category, notes } -> header names ('' / undefined = unmapped)
// returns { days: [{ date, what_i_did, tasks: [{title,status,category}] }], taskCount, warnings }
export function mapRows(rawRows, map) {
  const warnings = []
  const byDate = new Map()

  rawRows.forEach((row, i) => {
    const rowNum = i + 2 // account for header row when reporting to the user

    const date = parseDateCell(map.date ? row[map.date] : undefined)
    if (!date) {
      warnings.push({ row: rowNum, message: `Skipped: unreadable date "${map.date ? (row[map.date] ?? '') : ''}"` })
      return
    }

    const title = map.title ? String(row[map.title] ?? '').trim() : ''
    const note = map.notes ? String(row[map.notes] ?? '').trim() : ''
    if (!title && !note) {
      warnings.push({ row: rowNum, message: 'Skipped: no task title or note' })
      return
    }

    if (!byDate.has(date)) byDate.set(date, { date, what_i_did: '', tasks: [] })
    const day = byDate.get(date)

    if (note && !day.what_i_did.includes(note)) {
      day.what_i_did = day.what_i_did ? `${day.what_i_did}\n${note}` : note
    }

    if (title) {
      day.tasks.push({
        title,
        status: normalizeStatus(map.status ? row[map.status] : ''),
        category: map.category ? String(row[map.category] ?? '').trim() || null : null,
      })
    }
  })

  const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  const taskCount = days.reduce((n, d) => n + d.tasks.length, 0)
  return { days, taskCount, warnings }
}
