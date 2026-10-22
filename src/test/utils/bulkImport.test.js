import { describe, it, expect } from 'vitest'
import { parsePeopleRows, parseHolidayRows, parseRole, matchColumns } from '../../utils/bulkImport'

const ROLES = ['employee', 'ba', 'manager', 'hr']
const PROJECTS = [{ id: 'p1', name: 'Apollo' }]

const person = (name, email, role = '', project = '') => ({ 'Full name': name, 'Work email': email, Role: role, Project: project })

describe('parseRole', () => {
  it('defaults to employee', () => expect(parseRole('')).toBe('employee'))
  it('reads labels and keys in any case', () => {
    expect(parseRole('Business Analyst')).toBe('ba')
    expect(parseRole(' BA ')).toBe('ba')
    expect(parseRole('manager')).toBe('manager')
    expect(parseRole('Human Resources')).toBe('hr')
  })
  it('returns null for unknown roles', () => expect(parseRole('Wizard')).toBeNull())
})

describe('matchColumns', () => {
  it('does not give one column to two fields', () => {
    const map = matchColumns(['Holiday name', 'Date'], { date: ['date', 'day'], name: ['name', 'holiday'] })
    expect(map).toEqual({ date: 'Date', name: 'Holiday name' })
  })
})

describe('parsePeopleRows', () => {
  it('accepts valid rows and fills defaults', () => {
    const { valid, errors } = parsePeopleRows([person('Asha', 'ASHA@x.com', '', 'apollo')], { roles: ROLES, projects: PROJECTS })
    expect(errors).toEqual([])
    expect(valid[0]).toMatchObject({ row: 2, name: 'Asha', email: 'asha@x.com', role: 'employee', project_id: 'p1' })
  })

  it('reports every problem with its row', () => {
    const rows = [
      person('', 'bad'),
      person('Ben', 'ben@x.com', 'Admin'),
      person('Cara', 'cara@x.com', 'Wizard', 'Nope'),
      person('Dev', 'taken@x.com'),
    ]
    const { valid, errors } = parsePeopleRows(rows, { roles: ROLES, projects: PROJECTS, existingEmails: new Set(['taken@x.com']) })
    expect(valid).toEqual([])
    expect(errors.map(e => e.row)).toEqual([2, 3, 4, 5])
    expect(errors[0].message).toMatch(/Full name is empty/)
    expect(errors[0].message).toMatch(/not a valid email/)
    expect(errors[1].message).toMatch(/cannot add people as Admin/)
    expect(errors[2].message).toMatch(/Role "Wizard"/)
    expect(errors[2].message).toMatch(/Project "Nope"/)
    expect(errors[3].message).toMatch(/already has an account/)
  })

  it('flags duplicate emails within the file and skips blank rows', () => {
    const rows = [person('A', 'a@x.com'), person('', ''), person('A again', 'A@x.com')]
    const { valid, errors } = parsePeopleRows(rows, { roles: ROLES })
    expect(valid).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ row: 4 })
  })

  it('says which required columns are missing', () => {
    expect(parsePeopleRows([{ Something: 'x' }], { roles: ROLES }).missingColumns).toEqual(['Full name', 'Work email'])
  })
})

describe('parseHolidayRows', () => {
  it('parses common date formats and sorts by date', () => {
    const rows = [
      { Date: '15 Aug 2027', 'Holiday name': 'Independence Day' },
      { Date: '26/01/2027', 'Holiday name': 'Republic Day' },
      { Date: new Date(2027, 9, 29), 'Holiday name': 'Diwali' },
    ]
    const { valid, errors } = parseHolidayRows(rows)
    expect(errors).toEqual([])
    expect(valid.map(v => v.date)).toEqual(['2027-01-26', '2027-08-15', '2027-10-29'])
  })

  it('keeps the last row when a date repeats', () => {
    const rows = [{ Date: '2027-01-26', Name: 'First' }, { Date: '2027-01-26', Name: 'Second' }]
    expect(parseHolidayRows(rows).valid).toEqual([{ row: 3, date: '2027-01-26', name: 'Second' }])
  })

  it('reports unreadable dates and empty names', () => {
    const { errors } = parseHolidayRows([{ Date: 'someday', 'Holiday name': '' }])
    expect(errors[0].message).toBe('Date "someday" could not be read. Holiday name is empty')
  })
})
