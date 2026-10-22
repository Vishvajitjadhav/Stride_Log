import { useEffect, useState } from 'react'
import { useInstallPrompt } from '../lib/install'
import { LogoMark } from './Logo'
import Button from './ui/Button'
import Icon from './ui/Icon'

const KEY = 'stridelog:install_dismissed'
const SNOOZE_DAYS = 14

function snoozed() {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_DAYS * 864e5 } catch { return false }
}

// Phones and tablets: invite people to install the app. Android shows the
// browser's install prompt; iPhone and iPad get the Share steps instead.
// Dismissing hides it for two weeks; Account always keeps the install card.
export default function InstallBanner() {
  const { canPrompt, promptInstall, installed, ios } = useInstallPrompt()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (installed || snoozed()) return
    const t = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(t)
  }, [installed])

  if (!show || installed || (!canPrompt && !ios)) return null
  const dismiss = () => {
    try { localStorage.setItem(KEY, String(Date.now())) } catch { /* private mode */ }
    setShow(false)
  }

  return (
    <div className="lg:hidden fixed z-50 inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] mx-auto max-w-xl rise" role="dialog" aria-label="Install StrideLog">
      <div className="card p-4 flex items-start gap-3 shadow-[0_18px_40px_-16px_rgb(79_76_227/.45)]">
        <LogoMark size={44} className="float" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Install StrideLog</p>
          {canPrompt ? (
            <p className="text-xs text-gray-500 mt-0.5">One tap from your home screen, full screen, works offline.</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Tap <Icon name="share" size={14} className="inline align-[-2px] text-primary-600" /> Share in Safari, then <b className="font-semibold text-gray-700">Add to Home Screen</b>.
            </p>
          )}
          {canPrompt && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={async () => { if (await promptInstall()) setShow(false) }}><Icon name="install" size={15} /> Install</Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
            </div>
          )}
        </div>
        <button onClick={dismiss} className="p-1.5 -m-1 text-gray-400 hover:text-gray-700 rounded-lg" aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
    </div>
  )
}
