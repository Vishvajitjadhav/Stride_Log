// One navigation definition shared by the desktop sidebar, the mobile bottom
// tab bar and the mobile "More" page. `perm` is a permission from
// lib/permissions.js (omit = everyone). `tab` = shown in the phone tab bar.

export const NAV = [
  { group: 'Me', to: '/today',     label: 'My Day',    icon: 'today',     tab: true },
  { group: 'Me', to: '/dashboard', label: 'Dashboard', icon: 'dashboard', tab: true },
  { group: 'Me', to: '/calendar',  label: 'Calendar',  icon: 'calendar',  tab: true },
  { group: 'Me', to: '/history',   label: 'History',   icon: 'history' },

  { group: 'Team', to: '/team',      label: 'Team',          icon: 'team',      perm: 'viewTeam', tab: true },
  { group: 'Team', to: '/analytics', label: 'Analytics',     icon: 'analytics', perm: 'viewTeam' },
  { group: 'Team', to: '/assigned',  label: 'Assigned by me', icon: 'assign',   perm: 'assignTasks' },

  { group: 'Admin', to: '/admin/people',   label: 'People',   icon: 'people',   perm: 'managePeople', badge: 'pending' },
  { group: 'Admin', to: '/admin/settings', label: 'Settings', icon: 'settings', perm: 'manageCategories' },

  { group: 'Other', to: '/import',  label: 'Import',  icon: 'upload' },
  { group: 'Other', to: '/profile', label: 'Profile', icon: 'user' },
]

export function visibleNav(can) {
  return NAV.filter(n => !n.perm || can(n.perm))
}

export function pageTitle(pathname) {
  if (pathname.startsWith('/team/')) return 'Team member'
  if (pathname === '/more') return 'More'
  return NAV.find(n => n.to === pathname)?.label ?? 'StrideLog'
}
