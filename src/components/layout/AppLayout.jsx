import { Outlet, useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import OfflineBanner from '../OfflineBanner'
import UpdatePrompt from '../UpdatePrompt'
import InstallBanner from '../InstallBanner'

export default function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <OfflineBanner />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          <div key={pathname} className="page-in"><Outlet /></div>
        </main>
      </div>
      <BottomNav />
      <UpdatePrompt />
      <InstallBanner />
    </div>
  )
}
