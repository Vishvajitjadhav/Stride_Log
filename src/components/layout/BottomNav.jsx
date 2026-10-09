import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { visibleNav } from './nav'
import Icon from '../ui/Icon'

// Phone tab bar: the same few destinations as the sidebar, plus your account.
export default function BottomNav() {
  const { can } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const tabs = [...visibleNav(can), { to: '/profile', label: 'Account', icon: 'user' }]

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to}
            className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors ${
              isActive ? 'text-primary-800' : 'text-gray-400'}`}>
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon name={t.icon} size={22} strokeWidth={isActive ? 2.1 : 1.7} />
                  {t.badge === 'pending' && pending.length > 0 && <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-accent-500 rounded-full" />}
                </span>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
