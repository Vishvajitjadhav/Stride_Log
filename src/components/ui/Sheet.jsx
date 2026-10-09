import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// Bottom sheet on phones, centered dialog on larger screens.
export default function Sheet({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40 animate-[fade_.15s_ease-out]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} rounded-t-2xl sm:rounded-lg shadow-xl
          max-h-[92dvh] flex flex-col animate-[sheet_.2s_ease-out] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2 sm:pt-5">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
