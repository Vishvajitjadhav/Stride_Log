import { useLocation } from 'react-router-dom'
import { formatDisplay, todayISO } from '../../utils/dates'
import { pageTitle } from './nav'
import NotificationBell from '../NotificationBell'
import BrandMark from '../BrandMark'

export default function TopBar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 pt-[env(safe-area-inset-top)] box-content">
      <div className="flex items-center gap-3 min-w-0">
        <span className="lg:hidden"><BrandMark compact /></span>
        <h1 className="text-base font-semibold text-gray-900 truncate">{pageTitle(pathname)}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-gray-400">{formatDisplay(todayISO())}</span>
        <NotificationBell />
      </div>
    </header>
  )
}
