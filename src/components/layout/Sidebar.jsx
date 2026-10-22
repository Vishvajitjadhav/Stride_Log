import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { ROLE_LABELS } from '../../lib/permissions'
import { visibleNav } from './nav'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import BrandMark from '../BrandMark'
import { useSidebar } from '../../lib/sidebar'

// Desktop sidebar: light glass panel with a soft pill for the current page.
// Collapses to icons from the button at the top left of the header (or the [ key).
export default function Sidebar() {
  const { profile, can } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const { collapsed } = useSidebar()
  const items = visibleNav(can)

  const link = ({ isActive }) =>
    `group relative flex items-center gap-3 h-10 rounded-xl text-sm transition-all duration-200 ${collapsed ? 'justify-center px-0' : 'px-2'} ${
      isActive
        ? 'bg-gradient-to-r from-primary-50 to-primary-50/30 text-primary-700 font-semibold shadow-[inset_0_0_0_1px_var(--color-primary-100)]'
        : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900'
    }`

  return (
    <aside className={`hidden lg:flex shrink-0 h-dvh sticky top-0 glass border-r border-gray-200/70 flex-col transition-[width] duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-5'}`}>
        <BrandMark compact={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {!collapsed && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Menu</p>}
        {items.map(i => (
          <NavLink key={i.to} to={i.to} className={link} title={collapsed ? i.label : undefined}>
            {({ isActive }) => (
              <>
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                  isActive ? 'bg-gradient-to-br from-[#6c6af0] to-brand text-white shadow-[0_4px_12px_-4px_rgb(79_76_227/.6)]' : 'group-hover:scale-110'}`}>
                  <Icon name={i.icon} size={17} strokeWidth={isActive ? 2.1 : 1.8} />
                </span>
                {!collapsed && <span className="flex-1">{i.label}</span>}
                {i.badge === 'pending' && pending.length > 0 && (
                  collapsed
                    ? <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-surface" />
                    : <span className="text-[10px] font-semibold bg-accent-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center" title="Sign ups waiting for approval">{pending.length}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/profile" title={collapsed ? profile?.name : undefined}
        className={({ isActive }) => `mx-3 mb-3 flex items-center gap-3 p-2 rounded-xl border transition-colors ${collapsed ? 'justify-center border-transparent' : 'border-gray-200/70 bg-surface/60'} ${isActive ? '!border-primary-200 bg-primary-50/60' : 'hover:bg-gray-100/70'}`}>
        <Avatar person={profile} />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile?.name}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[profile?.role] ?? profile?.role}</p>
            </div>
            <Icon name="right" size={16} className="text-gray-400" />
          </>
        )}
      </NavLink>
    </aside>
  )
}
