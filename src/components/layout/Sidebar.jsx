import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { ROLE_LABELS } from '../../lib/permissions'
import { visibleNav } from './nav'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import BrandMark from '../BrandMark'
import { useSidebar } from '../../lib/sidebar'

// Desktop sidebar. Fixed navy in both themes; collapses to icons from the
// button at the top left of the header (or the [ key).
export default function Sidebar() {
  const { profile, can } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const { collapsed } = useSidebar()
  const items = visibleNav(can)

  const link = ({ isActive }) =>
    `relative flex items-center gap-3 h-9 rounded-md text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'} ${
      isActive ? 'bg-white/10 text-white font-medium' : 'text-[#c8d4e6]/80 hover:bg-white/5 hover:text-white'
    }`

  return (
    <aside className={`hidden lg:flex shrink-0 h-dvh sticky top-0 bg-[#132238] flex-col transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`h-14 flex items-center border-b border-white/10 ${collapsed ? 'justify-center' : 'px-5'}`}>
        <BrandMark inverted compact={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map(i => (
          <NavLink key={i.to} to={i.to} className={link} title={collapsed ? i.label : undefined}>
            <Icon name={i.icon} size={18} />
            {!collapsed && <span className="flex-1">{i.label}</span>}
            {i.badge === 'pending' && pending.length > 0 && (
              collapsed
                ? <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#c9a43f]" />
                : <span className="text-[10px] font-semibold bg-[#c9a43f] text-[#132238] rounded px-1.5 py-0.5 min-w-[18px] text-center" title="Sign ups waiting for approval">{pending.length}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/profile" title={collapsed ? profile?.name : undefined}
        className={({ isActive }) => `mx-3 mb-3 flex items-center gap-3 p-2 rounded-md transition-colors ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
        <Avatar person={profile} className="!bg-white/15 !text-white" />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.name}</p>
              <p className="text-xs text-[#c8d4e6]/70">{ROLE_LABELS[profile?.role] ?? profile?.role}</p>
            </div>
            <Icon name="right" size={16} className="text-[#c8d4e6]/50" />
          </>
        )}
      </NavLink>
    </aside>
  )
}
