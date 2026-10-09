import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { formatLong, todayISO } from '../../utils/dates'
import { pageTitle } from './nav'
import NotificationBell from '../NotificationBell'
import { LogoMark } from '../Logo'
import Icon from '../ui/Icon'
import { useTheme } from '../../lib/theme'

export default function TopBar() {
  const { pathname } = useLocation()
  const { can } = useAuth()
  const { dark, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-gray-200 pt-[env(safe-area-inset-top)]">
      <div className="h-14 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <span className="lg:hidden"><LogoMark size={26} /></span>
          <h1 className="text-[15px] font-semibold text-gray-900 truncate">{pageTitle(pathname, can)}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden md:inline text-sm text-gray-500 mr-2">{formatLong(todayISO())}</span>
          <button onClick={() => setTheme(dark ? 'light' : 'dark')}
            className="h-9 w-9 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
            <Icon name={dark ? 'sun' : 'moon'} size={19} />
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
