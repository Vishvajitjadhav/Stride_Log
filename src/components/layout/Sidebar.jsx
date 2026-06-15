import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/useTeam'

const employeeLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/log',       label: 'Log Today',  icon: '✎' },
  { to: '/history',   label: 'History',    icon: '◷' },
  { to: '/import',    label: 'Import',     icon: '↥' },
]

const staffLinks = [
  { to: '/admin',           label: 'Team',      icon: '◉' },
  { to: '/admin/analytics', label: 'Analytics', icon: '◓' },
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`

export default function Sidebar() {
  const { profile, isStaff, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: pending = [] } = usePendingApprovals({ enabled: isAdmin })

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-black text-sm">S</span>
        </div>
        <span className="font-bold text-gray-900">StrideLog</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {employeeLinks.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}

        {isStaff && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Team</span>
            </div>
            {staffLinks.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} className={linkClass}>
                <span>{icon}</span>
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin/approvals" className={linkClass}>
                <span>⧉</span>
                <span className="flex-1">Approvals</span>
                {pending.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {pending.length}
                  </span>
                )}
              </NavLink>
            )}
            <NavLink to="/admin/settings" className={linkClass}>
              <span>⚙</span>
              Settings
            </NavLink>
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{profile?.avatar_initials ?? '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
          </div>
          <button onClick={handleSignOut} className="text-gray-400 hover:text-gray-600 text-sm" title="Sign out">⏏</button>
        </div>
      </div>
    </aside>
  )
}
