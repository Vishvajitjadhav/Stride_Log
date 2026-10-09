import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { formatLong, todayISO } from '../../utils/dates'
import { pageTitle } from './nav'
import NotificationBell from '../NotificationBell'
import { LogoMark } from '../Logo'

export default function TopBar() {
  const { pathname } = useLocation()
  const { can } = useAuth()

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 pt-[env(safe-area-inset-top)]">
      <div className="h-14 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <span className="lg:hidden"><LogoMark size={26} /></span>
          <h1 className="text-[15px] font-semibold text-gray-900 truncate">{pageTitle(pathname, can)}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-sm text-gray-500">{formatLong(todayISO())}</span>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
