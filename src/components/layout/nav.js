// One navigation definition for the desktop top bar and the phone tab bar.
//   perm:    permission needed to see the item (lib/permissions.js)
//   notPerm: hide the item from people who have this permission
//   phone:   false keeps it out of the phone tab bar (desktop menu only)
//   short:   shorter label for the phone tab bar
// Managers / HR / admins: Team · Reports · Leaderboard · Projects · Admin (their
// own day is optional and lives under Account). Everyone else: Today · My
// Progress, plus Team and Leaderboard when a manager shares them.

const NAV = [
  { to: '/team',     label: 'Team',        icon: 'team',      perm: 'viewTeam' },
  { to: '/reports',  label: 'Reports',     icon: 'analytics', perm: 'viewTeam' },
  { to: '/leaderboard', label: 'Leaderboard', short: 'Leaders', icon: 'star', perm: 'viewTeam' },
  { to: '/projects', label: 'Projects',    icon: 'flag',      perm: 'viewTeam', phone: false },
  { to: '/today',    label: 'Today',       icon: 'today',     notPerm: 'viewTeam' },
  { to: '/progress', label: 'My Progress', icon: 'dashboard', notPerm: 'viewTeam' },
  // Shared with employees when a manager turns it on.
  { to: '/team',     label: 'Team',        icon: 'team',      perm: 'seeTeamTasks', notPerm: 'viewTeam' },
  { to: '/leaderboard', label: 'Leaderboard', short: 'Leaders', icon: 'star', perm: 'seeLeaderboard', notPerm: 'viewTeam' },
  { to: '/admin',    label: 'Admin',       icon: 'settings',  perm: 'manageCategories', badge: 'pending' },
]

export function visibleNav(can) {
  return NAV
    .filter(n => (!n.perm || can(n.perm)) && (!n.notPerm || !can(n.notPerm)))
    // Managers only manage categories, so call it Settings for them.
    .map(n => (n.to === '/admin' && !can('managePeople') ? { ...n, label: 'Settings' } : n))
}

export function homePath(can) {
  return can('viewTeam') ? '/team' : '/today'
}

const TITLES = {
  '/profile': 'Profile',
  '/assigned': 'Assigned by me',
  '/import': 'Import from Excel',
  '/progress': 'My Progress',
  '/today': 'My day',
}

export function pageTitle(pathname, can) {
  if (pathname.startsWith('/team/')) return 'Employee'
  if (TITLES[pathname]) return TITLES[pathname]
  return visibleNav(can).find(n => n.to === pathname)?.label ?? 'StrideLog'
}

// Load a page's code as soon as someone points at its menu item, so the
// click feels instant. Same imports as App.jsx, so Vite shares the chunk.
const PAGES = {
  '/team': () => import('../../pages/Team'),
  '/reports': () => import('../../pages/Reports'),
  '/leaderboard': () => import('../../pages/Leaderboard'),
  '/projects': () => import('../../pages/Projects'),
  '/progress': () => import('../../pages/Progress'),
  '/admin': () => import('../../pages/admin/Admin'),
}
const fetched = new Set()
export function prefetchPage(to) {
  if (fetched.has(to) || !PAGES[to]) return
  fetched.add(to)
  PAGES[to]().catch(() => fetched.delete(to))
}
