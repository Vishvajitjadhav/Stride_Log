import { useLocation } from 'react-router-dom'
import { formatDisplay, todayISO } from '../../utils/dates'

const titles = {
  '/dashboard':      'Dashboard',
  '/log':            'Log Today',
  '/history':        'My History',
  '/admin':          'Team',
  '/admin/settings': 'Settings',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'StrideLog'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      <span className="text-sm text-gray-400">{formatDisplay(todayISO())}</span>
    </header>
  )
}
