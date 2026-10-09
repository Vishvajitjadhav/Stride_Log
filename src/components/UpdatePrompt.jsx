import { useRegisterSW } from 'virtual:pwa-register/react'

// "New version available" toast for the PWA service worker.
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for a new deploy every hour while the app is open.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null
  return (
    <div className="fixed z-50 left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-6 lg:w-80 bg-[#0f172a] ring-1 ring-white/10 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
      <p className="text-sm flex-1">A new version of the app is available.</p>
      <button onClick={() => setNeedRefresh(false)} className="text-sm text-gray-300">Later</button>
      <button onClick={() => updateServiceWorker(true)} className="text-sm font-semibold text-primary-300">Reload</button>
    </div>
  )
}
