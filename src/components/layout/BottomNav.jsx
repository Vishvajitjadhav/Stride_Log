import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { visibleNav, prefetchPage } from './nav'
import Icon from '../ui/Icon'

// Phone and tablet tab bar: a floating glass bar with the same destinations as
// the desktop menu, plus your account. Tablets also get the desktop only items.
export default function BottomNav() {
  const { can } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const tabs = [...visibleNav(can), { to: '/profile', label: 'Account', icon: 'user' }]

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-xl flex glass rounded-2xl border border-gray-200/70 shadow-[0_10px_30px_-10px_rgb(20_26_41/.25)] px-1">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} onTouchStart={() => prefetchPage(t.to)}
            className={({ isActive }) => `${t.phone === false ? 'hidden md:flex' : 'flex'} flex-1 min-w-0 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors ${
              isActive ? 'text-primary-700' : 'text-gray-500'}`}>
            {({ isActive }) => (
              <>
                <span className={`relative flex items-center justify-center h-8 w-12 rounded-xl transition-all duration-300 ${
                  isActive ? 'bg-gradient-to-br from-[#6c6af0] to-brand text-white shadow-[0_6px_14px_-6px_rgb(79_76_227/.7)] scale-105' : ''}`}>
                  <Icon name={t.icon} size={20} strokeWidth={isActive ? 2.1 : 1.8} />
                  {t.badge === 'pending' && pending.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-500 rounded-full ring-2 ring-surface" />}
                </span>
                <span className="truncate max-w-full px-0.5">{t.short ?? t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
