import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import OfflineBanner from '../OfflineBanner'
import UpdatePrompt from '../UpdatePrompt'

export default function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <OfflineBanner />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <UpdatePrompt />
    </div>
  )
}
