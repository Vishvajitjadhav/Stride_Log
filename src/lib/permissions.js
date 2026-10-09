// Single source of truth for what each role may do in the UI.
// The database (RLS + triggers) enforces the same rules — this only decides
// what to show. Keep in sync with supabase/migrations/*_roles_teams.sql.

export const ROLES = ['employee', 'ba', 'manager', 'hr', 'admin']

export const ROLE_LABELS = {
  employee: 'Employee',
  ba: 'Business Analyst',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Admin',
}

// action -> (profile) => boolean
const RULES = {
  // Assign / edit tasks for other people
  assignTasks: p => ['manager', 'admin'].includes(p.role) || p.can_assign_tasks === true,
  // See everyone's logs, team dashboards & reports
  viewTeam: p => ['manager', 'hr', 'admin'].includes(p.role) || p.can_assign_tasks === true,
  // Company-wide analytics & PDF
  viewCompany: p => ['manager', 'hr', 'admin'].includes(p.role),
  // Approve sign-ups, edit people (role/team/manager), invite users
  managePeople: p => ['hr', 'admin'].includes(p.role),
  manageTeams: p => ['hr', 'admin'].includes(p.role),
  manageHolidays: p => ['hr', 'admin'].includes(p.role),
  manageCategories: p => ['manager', 'hr', 'admin'].includes(p.role),
  // Grant can_assign_tasks, assign the admin role, company name & logo
  grantPermissions: p => p.role === 'admin',
  manageCompany: p => p.role === 'admin',
  // Import a spreadsheet on behalf of someone else
  importForOthers: p => p.role === 'admin',
}

export function can(profile, action) {
  if (!profile || !profile.is_approved || profile.is_active === false) return false
  const rule = RULES[action]
  if (!rule) throw new Error(`Unknown permission: ${action}`)
  return rule(profile)
}

// Roles a given user may hand out when editing someone else.
export function assignableRoles(profile) {
  if (can(profile, 'grantPermissions')) return ROLES
  if (can(profile, 'managePeople')) return ROLES.filter(r => r !== 'admin')
  return []
}
