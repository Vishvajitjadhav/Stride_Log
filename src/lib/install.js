import { useSyncExternalStore } from 'react'

// Capture the browser's "install app" prompt as early as possible (it fires
// once, often before React mounts) so a button can trigger it later.
let deferred = null
const listeners = new Set()
const emit = () => listeners.forEach(l => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => Boolean(deferred),
  )
  async function promptInstall() {
    if (!deferred) return false
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    emit()
    return outcome === 'accepted'
  }
  return { canPrompt, promptInstall, installed: isStandalone(), ios: isIOS() }
}
