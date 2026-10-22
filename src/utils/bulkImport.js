// Pure parsing + validation for the admin bulk imports (people, holidays).
// The sheet component (components/BulkImport.jsx) reads files and writes to the
// database; this module only checks rows, so it is fully unit tested.

import { parseDateCell } from './importMap'
import { ROLE_LABELS } from '../lib/permissions'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Templates: the header row, two example rows and how to fill each column.
export const PEOPLE_TEMPLATE = {
  name: 'stridelog_people',
  columns: ['Full name', 'Work email', 'Role', 'Project'],
  sample: [
    ['Asha Patel', 'asha.patel@yourcompany.com', 'Employee', ''],
    ['Rohan Mehta', 'rohan.mehta@yourcompany.com', 'Manager', ''],
  ],
  help: [
    ['Full name', 'Required.'],
    ['Work email', 'Required. One account per email.'],
    ['Role', `Optional, Employee when empty. One of: ${Object.values(ROLE_LABELS).join(', ')}.`],
    ['Project', 'Optional. Must match a project name on the Projects page.'],
  ],
}

export const HOLIDAY_TEMPLATE = {
  name: 'stridelog_holidays',
  columns: ['Date', 'Holiday name'],
  sample: [
    ['26 Jan 2027', 'Republic Day'],
    ['15 Aug 2027', 'Independence Day'],
  ],
  help: [
    ['Date', 'Required. For example 26 Jan 2027 or 26/01/2027 (day first).'],
    ['Holiday name', 'Required.'],
  ],
}

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = v => String(v ?? '').trim()

// Find which sheet column holds each field, by loose header match. Earlier
// hints win, and a column already taken by another field is skipped.
export function matchColumns(columns, fields) {
  const map = {}
  const taken = new Set()
  for (const [key, hints] of Object.entries(fields)) {
    for (const h of hints) {
      map[key] = columns.find(c => !taken.has(c) && norm(c).includes(h))
      if (map[key]) break
    }
    if (map[key]) taken.add(map[key])
  }
  return map
}

// "Business Analyst", "ba", "BA " → 'ba'. Empty → 'employee'. Unknown → null.
export function parseRole(value) {
  const v = norm(value)
  if (!v) return 'employee'
  const hit = Object.entries(ROLE_LABELS).find(([key, label]) => norm(key) === v || norm(label) === v)
  if (hit) return hit[0]
  if (v === 'humanresources') return 'hr'
  if (v === 'administrator') return 'admin'
  return null
}

const isBlank = row => Object.values(row).every(v => text(v) === '')

// rows: sheet rows keyed by header. Returns { valid, errors, missingColumns }.
//   roles: roles the importer may give; projects: [{ id, name }]
//   existingEmails: emails that already have an account (lower case)
export function parsePeopleRows(rows, { roles, projects = [], existingEmails = new Set() }) {
  const columns = Object.keys(rows[0] ?? {})
  const col = matchColumns(columns, { name: ['name'], email: ['email', 'mail'], role: ['role'], project: ['project', 'team'] })
  const missingColumns = [!col.name && 'Full name', !col.email && 'Work email'].filter(Boolean)
  if (missingColumns.length) return { valid: [], errors: [], missingColumns }

  const projectByName = new Map(projects.map(p => [norm(p.name), p]))
  const seen = new Set()
  const valid = []
  const errors = []

  rows.forEach((r, i) => {
    if (isBlank(r)) return
    const row = i + 2 // header is row 1
    const name = text(r[col.name])
    const email = text(r[col.email]).toLowerCase()
    const roleCell = col.role ? text(r[col.role]) : ''
    const projectCell = col.project ? text(r[col.project]) : ''
    const role = parseRole(roleCell)
    const project = projectCell ? projectByName.get(norm(projectCell)) : null

    const problems = []
    if (!name) problems.push('Full name is empty')
    if (!email) problems.push('Work email is empty')
    else if (!EMAIL.test(email)) problems.push(`"${email}" is not a valid email`)
    else if (existingEmails.has(email)) problems.push(`${email} already has an account`)
    else if (seen.has(email)) problems.push(`${email} appears twice in the file`)
    if (!role) problems.push(`Role "${roleCell}" is not known`)
    else if (!roles.includes(role)) problems.push(`You cannot add people as ${ROLE_LABELS[role]}`)
    if (projectCell && !project) problems.push(`Project "${projectCell}" was not found`)

    if (email) seen.add(email)
    if (problems.length) errors.push({ row, label: name || email || `Row ${row}`, message: problems.join('. ') })
    else valid.push({ row, name, email, role, project_id: project?.id ?? null, projectName: project?.name ?? '' })
  })
  return { valid, errors, missingColumns }
}

// Later rows win when a date appears twice, like saving them one by one would.
export function parseHolidayRows(rows) {
  const columns = Object.keys(rows[0] ?? {})
  const col = matchColumns(columns, { date: ['date', 'day'], name: ['name', 'holiday', 'occasion', 'festival'] })
  const missingColumns = [!col.date && 'Date', !col.name && 'Holiday name'].filter(Boolean)
  if (missingColumns.length) return { valid: [], errors: [], missingColumns }

  const byDate = new Map()
  const errors = []
  rows.forEach((r, i) => {
    if (isBlank(r)) return
    const row = i + 2
    const raw = r[col.date]
    const date = parseDateCell(raw)
    const name = text(r[col.name])
    const problems = []
    if (!date) problems.push(text(raw) ? `Date "${text(raw)}" could not be read` : 'Date is empty')
    if (!name) problems.push('Holiday name is empty')
    if (problems.length) errors.push({ row, label: name || text(raw) || `Row ${row}`, message: problems.join('. ') })
    else byDate.set(date, { row, date, name })
  })
  const valid = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  return { valid, errors, missingColumns }
}
