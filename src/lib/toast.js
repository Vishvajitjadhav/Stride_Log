import { useSyncExternalStore } from 'react'

// Tiny toast store: toast('Saved') or toast.error('Could not save').
let items = []
const listeners = new Set()
const emit = () => listeners.forEach(l => l())
let nextId = 1

function push(message, tone = 'success', ms = 3200) {
  const id = nextId++
  items = [...items, { id, message, tone }]
  emit()
  setTimeout(() => dismiss(id), ms)
  return id
}

export function dismiss(id) {
  items = items.filter(t => t.id !== id)
  emit()
}

export const toast = Object.assign((m, ms) => push(m, 'success', ms), {
  error: (m, ms = 5000) => push(m, 'error', ms),
  info: (m, ms) => push(m, 'info', ms),
})

export function useToasts() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => items)
}
