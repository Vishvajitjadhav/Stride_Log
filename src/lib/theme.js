import { useSyncExternalStore } from 'react'

// Theme preference: 'light' | 'dark' | 'system'. index.html applies it before
// React loads (no flash); this module keeps it in sync afterwards.
const KEY = 'stridelog:theme'
const listeners = new Set()
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function read() {
  try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
}

function apply(pref) {
  const dark = pref === 'dark' || (pref === 'system' && media?.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0e1a' : '#f6f7fc')
}

media?.addEventListener('change', () => {
  if (read() === 'system') { apply('system'); listeners.forEach(l => l()) }
})

function setTheme(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* storage unavailable */ }
  apply(pref)
  listeners.forEach(l => l())
}

const isDark = () => document.documentElement.classList.contains('dark')

export function useTheme() {
  const subscribe = cb => { listeners.add(cb); return () => listeners.delete(cb) }
  const pref = useSyncExternalStore(subscribe, read)
  const dark = useSyncExternalStore(subscribe, isDark)
  return { pref, dark, setTheme }
}
