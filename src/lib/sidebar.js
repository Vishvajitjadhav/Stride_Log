import { useSyncExternalStore } from 'react'

// Desktop sidebar collapsed / expanded, shared by the sidebar and the top bar
// button, remembered across visits. Shortcut: "[" (when not typing).
const KEY = 'stridelog:sidebar'
const listeners = new Set()
let collapsed = (() => { try { return localStorage.getItem(KEY) === 'collapsed' } catch { return false } })()

function setCollapsed(next) {
  collapsed = next
  try { localStorage.setItem(KEY, next ? 'collapsed' : 'open') } catch { /* storage unavailable */ }
  listeners.forEach(l => l())
}

const toggle = () => setCollapsed(!collapsed)

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
    toggle()
  })
}

export function useSidebar() {
  const value = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => collapsed)
  return { collapsed: value, toggle }
}
