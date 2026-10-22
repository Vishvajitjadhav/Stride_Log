import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { formatLong, todayISO } from '../../utils/dates'
import { pageTitle } from './nav'
import NotificationBell from '../NotificationBell'
import { LogoMark } from '../Logo'
import Icon from '../ui/Icon'
import { useTheme } from '../../lib/theme'
import { useSidebar } from '../../lib/sidebar'

const iconButton = 'h-9 w-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors'

export default function TopBar() {
  const { pathname } = useLocation()
  const { can } = useAuth()
  const { dark, setTheme } = useTheme()
  const { collapsed, toggle } = useSidebar()

  return (
    <header className="sticky top-0 z-30 glass border-b border-gray-200/60 pt-[env(safe-area-inset-top)]">
      <div className="h-14 lg:h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <span className="lg:hidden"><LogoMark size={28} /></span>
          <button onClick={toggle} className={`hidden lg:flex -ml-2 ${iconButton}`}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={`${collapsed ? 'Expand' : 'Collapse'} menu  [`}>
            <Icon name="panel" size={19} />
          </button>
          <h1 className="text-[15px] sm:text-base font-semibold text-gray-900 truncate">{pageTitle(pathname, can)}</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden md:inline-flex items-center gap-2 text-sm text-gray-500 mr-1 rounded-full bg-surface/70 border border-gray-200/70 px-3 h-8">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-500" />{formatLong(todayISO())}
          </span>
          <button onClick={() => setTheme(dark ? 'light' : 'dark')} className={iconButton}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
            <Icon name={dark ? 'sun' : 'moon'} size={19} />
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
