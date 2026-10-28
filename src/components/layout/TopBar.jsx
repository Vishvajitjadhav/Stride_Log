import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import { formatLong, todayISO } from '../../utils/dates'
import { pageTitle, visibleNav, homePath, prefetchPage } from './nav'
import NotificationBell from '../NotificationBell'
import BrandMark from '../BrandMark'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import { useTheme } from '../../lib/theme'

const iconButton = 'h-9 w-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-200'

// The app's one header: a deep indigo bar that sets itself apart from the
// light page. Desktop shows the menu here (no sidebar, so pages get the full
// width); phones and tablets keep the bottom tab bar and show the page name.
export default function TopBar() {
  const { pathname } = useLocation()
  const { can, profile } = useAuth()
  const { dark, setTheme } = useTheme()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const items = visibleNav(can)
  const title = pageTitle(pathname, can)
  const inMenu = items.some(i => pathname === i.to || pathname.startsWith(`${i.to}/`))

  return (
    <header className="sticky top-0 z-30 topbar pt-[env(safe-area-inset-top)]">
      <div className="h-14 flex items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link to={homePath(can)} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-white/60" aria-label="StrideLog home">
          <span className="hidden sm:block"><BrandMark inverted /></span>
          <span className="sm:hidden"><BrandMark compact inverted /></span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-6 min-w-0" aria-label="Main">
          {items.map(i => (
            <NavLink key={i.to} to={i.to} onMouseEnter={() => prefetchPage(i.to)} onFocus={() => prefetchPage(i.to)}
              className={({ isActive }) => `topnav ${isActive ? 'is-active' : ''}`}>
              <Icon name={i.icon} size={16} />
              <span>{i.label}</span>
              {i.badge === 'pending' && pending.length > 0 && (
                <span className="text-[10px] font-semibold bg-accent-500 text-white rounded-full px-1.5 min-w-[18px] text-center" title="Sign ups waiting for approval">{pending.length}</span>
              )}
            </NavLink>
          ))}
          {!inMenu && <span className="ml-2 pl-3 border-l border-white/15 text-sm font-semibold text-white truncate">{title}</span>}
        </nav>
        <h1 className="lg:hidden ml-2 text-[15px] font-semibold text-white truncate">{title}</h1>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <span className="hidden xl:inline-flex items-center gap-2 text-xs text-white/70 mr-1 rounded-full bg-white/[.06] ring-1 ring-inset ring-white/10 px-3 h-8">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" />{formatLong(todayISO())}
          </span>
          <button onClick={() => setTheme(dark ? 'light' : 'dark')} className={iconButton}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
            <Icon name={dark ? 'sun' : 'moon'} size={18} />
          </button>
          <NotificationBell tone="dark" />
          <NavLink to="/profile" title={`${profile?.name ?? 'Account'}, account and settings`}
            className={({ isActive }) => `hidden lg:flex items-center gap-2 ml-1 pl-1 pr-2.5 h-9 rounded-full transition-all duration-200 hover:bg-white/10 ${isActive ? 'bg-white/15 ring-1 ring-inset ring-white/15' : ''}`}>
            <Avatar person={profile} size="xs" />
            <span className="text-sm font-medium text-white/90 max-w-[9rem] truncate hidden xl:inline">{profile?.name?.split(' ')[0]}</span>
          </NavLink>
        </div>
      </div>
    </header>
  )
}
