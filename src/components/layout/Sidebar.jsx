import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { ROLE_LABELS } from '../../lib/permissions'
import { visibleNav } from './nav'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import BrandMark from '../BrandMark'

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors ${
    isActive ? 'bg-white/10 text-white font-medium' : 'text-primary-100/80 hover:bg-white/5 hover:text-white'
  }`

// Dark navy sidebar for desktop.
export default function Sidebar() {
  const { profile, can } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const items = visibleNav(can)

  return (
    <aside className="hidden lg:flex w-60 shrink-0 h-dvh sticky top-0 bg-primary-900 flex-col">
      <div className="px-5 h-16 flex items-center border-b border-white/10">
        <BrandMark inverted />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map(i => (
          <NavLink key={i.to} to={i.to} className={linkClass}>
            <Icon name={i.icon} size={18} />
            <span className="flex-1">{i.label}</span>
            {i.badge === 'pending' && pending.length > 0 && (
              <span className="text-[10px] font-semibold bg-accent-500 text-primary-900 rounded px-1.5 py-0.5 min-w-[18px] text-center" title="Sign ups waiting for approval">
                {pending.length}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/profile" className={({ isActive }) => `mx-3 mb-3 flex items-center gap-3 p-2 rounded-md transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
        <Avatar person={profile} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{profile?.name}</p>
          <p className="text-xs text-primary-200/80">{ROLE_LABELS[profile?.role] ?? profile?.role}</p>
        </div>
        <Icon name="right" size={16} className="text-primary-200/60" />
      </NavLink>
    </aside>
  )
}
