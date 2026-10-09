// One navigation definition for the desktop sidebar and the phone tab bar.
//   perm:    permission needed to see the item (lib/permissions.js)
//   notPerm: hide the item from people who have this permission
// Managers / HR / admins: Team · Reports · Today · Admin
// Everyone else:          Today · My Progress

export const NAV = [
  { to: '/team',     label: 'Team',        icon: 'team',      perm: 'viewTeam' },
  { to: '/reports',  label: 'Reports',     icon: 'analytics', perm: 'viewTeam' },
  { to: '/today',    label: 'Today',       icon: 'today' },
  { to: '/progress', label: 'My Progress', icon: 'dashboard', notPerm: 'viewTeam' },
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
}

export function pageTitle(pathname, can) {
  if (pathname.startsWith('/team/')) return 'Employee'
  if (TITLES[pathname]) return TITLES[pathname]
  return visibleNav(can).find(n => n.to === pathname)?.label ?? 'StrideLog'
}
