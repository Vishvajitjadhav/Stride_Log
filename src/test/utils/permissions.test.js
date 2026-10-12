import { describe, it, expect } from 'vitest'
import { can, assignableRoles, ROLES } from '../../lib/permissions'

const p = (role, extra = {}) => ({ role, is_approved: true, is_active: true, can_assign_tasks: false, ...extra })

describe('can()', () => {
  it('denies everything to missing, unapproved or inactive users', () => {
    expect(can(null, 'viewTeam')).toBe(false)
    expect(can(p('admin', { is_approved: false }), 'manageCompany')).toBe(false)
    expect(can(p('admin', { is_active: false }), 'manageCompany')).toBe(false)
  })

  it('matches the access table in PLAN.md', () => {
    const table = {
      assignTasks:      { employee: false, ba: false, manager: true,  hr: false, admin: true },
      viewTeam:         { employee: false, ba: false, manager: true,  hr: true,  admin: true },
      viewCompany:      { employee: false, ba: false, manager: true,  hr: true,  admin: true },
      managePeople:     { employee: false, ba: false, manager: false, hr: true,  admin: true },
      manageHolidays:   { employee: false, ba: false, manager: false, hr: true,  admin: true },
      manageCategories: { employee: false, ba: false, manager: true,  hr: true,  admin: true },
      grantPermissions: { employee: false, ba: false, manager: false, hr: false, admin: true },
      manageCompany:    { employee: false, ba: false, manager: false, hr: false, admin: true },
    }
    for (const [action, byRole] of Object.entries(table)) {
      for (const role of ROLES) {
        expect([action, role, can(p(role), action)]).toEqual([action, role, byRole[role]])
      }
    }
  })

  it('a granted BA (or employee) can assign tasks and view the team', () => {
    expect(can(p('ba', { can_assign_tasks: true }), 'assignTasks')).toBe(true)
    expect(can(p('ba', { can_assign_tasks: true }), 'viewTeam')).toBe(true)
    expect(can(p('employee', { can_assign_tasks: true }), 'assignTasks')).toBe(true)
    expect(can(p('ba', { can_assign_tasks: true }), 'managePeople')).toBe(false)
  })

  it('throws on unknown actions so typos are caught', () => {
    expect(() => can(p('admin'), 'fly')).toThrow()
  })
})

describe('assignableRoles', () => {
  it('admins can hand out every role, HR everything but admin, others nothing', () => {
    expect(assignableRoles(p('admin'))).toEqual(ROLES)
    expect(assignableRoles(p('hr'))).not.toContain('admin')
    expect(assignableRoles(p('manager'))).toEqual([])
  })
})

describe('team sharing', () => {
  const employee = { role: 'employee', is_approved: true, is_active: true }
  const manager = { role: 'manager', is_approved: true, is_active: true }
  const hr = { role: 'hr', is_approved: true, is_active: true }

  it('employees see team tasks and the leaderboard only when shared', () => {
    expect(can(employee, 'seeTeamTasks', { team_tasks_visible: false })).toBe(false)
    expect(can(employee, 'seeTeamTasks', { team_tasks_visible: true })).toBe(true)
    expect(can(employee, 'seeLeaderboard', { leaderboard_visible: false })).toBe(false)
    expect(can(employee, 'seeLeaderboard', { leaderboard_visible: true })).toBe(true)
    expect(can(employee, 'seeLeaderboard')).toBe(false)
  })

  it('managers always see both and control the switches; HR sees but does not control', () => {
    expect(can(manager, 'seeLeaderboard', { leaderboard_visible: false })).toBe(true)
    expect(can(manager, 'manageSharing')).toBe(true)
    expect(can(hr, 'seeTeamTasks', {})).toBe(true)
    expect(can(hr, 'manageSharing')).toBe(false)
    expect(can(employee, 'manageSharing')).toBe(false)
  })
})
