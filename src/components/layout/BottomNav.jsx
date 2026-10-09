import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { visibleNav } from './nav'
import Icon from '../ui/Icon'

// Phone tab bar: up to 4 primary destinations + "More".
export default function BottomNav() {
  const { can } = useAuth()
  const { pathname } = useLocation()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const tabs = visibleNav(can).filter(n => n.tab).slice(0, 4)
  const moreActive = !tabs.some(t => pathname === t.to || pathname.startsWith(t.to + '/'))

  const cls = active =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium transition-colors ${
      active ? 'text-primary-600' : 'text-gray-400'
    }`

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => cls(isActive)}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </NavLink>
        ))}
        <NavLink to="/more" className={cls(moreActive)}>
          <span className="relative">
            <Icon name="more" size={22} />
            {pending.length > 0 && <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </span>
          More
        </NavLink>
      </div>
    </nav>
  )
}
