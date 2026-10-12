// Single source of truth for what each role may do in the UI.
// The database (RLS + triggers) enforces the same rules — this only decides
// what to show. Keep in sync with supabase/migrations/*_roles_teams.sql.

export const ROLES = ['employee', 'ba', 'manager', 'hr', 'admin']

// Roles expected to log their day. Managers, HR and admins mainly review
// work, so logging is optional for them and they are left out of team numbers.
const TRACKED_ROLES = ['employee', 'ba']
export const isTracked = p => TRACKED_ROLES.includes(p?.role)

export const ROLE_LABELS = {
  employee: 'Employee',
  ba: 'Business Analyst',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Admin',
}

// action -> (profile, sharing) => boolean
// sharing: the company switches managers control ({ team_tasks_visible, leaderboard_visible }).
const RULES = {
  // Assign / edit tasks for other people
  assignTasks: p => ['manager', 'admin'].includes(p.role) || p.can_assign_tasks === true,
  // See everyone's logs, team dashboards & reports
  viewTeam: p => ['manager', 'hr', 'admin'].includes(p.role) || p.can_assign_tasks === true,
  // Company-wide analytics & PDF
  viewCompany: p => ['manager', 'hr', 'admin'].includes(p.role),
  // Approve sign-ups, edit people (role/team/manager), invite users
  managePeople: p => ['hr', 'admin'].includes(p.role),
  manageProjects: p => ['manager', 'hr', 'admin'].includes(p.role),
  manageHolidays: p => ['hr', 'admin'].includes(p.role),
  manageCategories: p => ['manager', 'hr', 'admin'].includes(p.role),
  // Grant can_assign_tasks, assign the admin role, company name & logo
  grantPermissions: p => p.role === 'admin',
  manageCompany: p => p.role === 'admin',
  // Import a spreadsheet on behalf of someone else
  importForOthers: p => p.role === 'admin',
  // See what the rest of the team is working on (read only for employees)
  seeTeamTasks: (p, s) => RULES.viewTeam(p) || s?.team_tasks_visible === true,
  // See the recognition leaderboard
  seeLeaderboard: (p, s) => RULES.viewTeam(p) || s?.leaderboard_visible === true,
  // Turn the two sharing switches on or off
  manageSharing: p => ['manager', 'admin'].includes(p.role),
}

export function can(profile, action, sharing) {
  if (!profile || !profile.is_approved || profile.is_active === false) return false
  const rule = RULES[action]
  if (!rule) throw new Error(`Unknown permission: ${action}`)
  return rule(profile, sharing)
}

// Roles a given user may hand out when editing someone else.
export function assignableRoles(profile) {
  if (can(profile, 'grantPermissions')) return ROLES
  if (can(profile, 'managePeople')) return ROLES.filter(r => r !== 'admin')
  return []
}
