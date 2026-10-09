import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { ROLE_LABELS } from '../../lib/permissions'
import { visibleNav } from './nav'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import BrandMark from '../BrandMark'

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`

export default function Sidebar() {
  const { profile, can, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const items = visibleNav(can)
  const groups = [...new Set(items.map(i => i.group))]

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <aside className="hidden lg:flex w-60 shrink-0 h-dvh sticky top-0 bg-white border-r border-gray-100 flex-col">
      <div className="px-5 py-4 border-b border-gray-100">
        <BrandMark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {groups.map(g => (
          <div key={g}>
            {g !== 'Me' && (
              <p className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{g}</p>
            )}
            {items.filter(i => i.group === g).map(i => (
              <NavLink key={i.to} to={i.to} className={linkClass}>
                <Icon name={i.icon} size={18} />
                <span className="flex-1">{i.label}</span>
                {i.badge === 'pending' && pending.length > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {pending.length}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar person={profile} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
            <p className="text-xs text-gray-400">{ROLE_LABELS[profile?.role] ?? profile?.role}</p>
          </div>
          <button onClick={handleSignOut} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg" title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
