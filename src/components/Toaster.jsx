import { createPortal } from 'react-dom'
import { useToasts, dismiss } from '../lib/toast'
import Icon from './ui/Icon'

const TONE = {
  success: { icon: 'check', dot: 'bg-emerald-500' },
  error: { icon: 'alert', dot: 'bg-red-500' },
  info: { icon: 'bell', dot: 'bg-[#6f8bb6]' },
}

// Bottom-centre on phones (above the tab bar), bottom-right on desktop.
export default function Toaster() {
  const items = useToasts()
  return createPortal(
    <div aria-live="polite" className="fixed z-[60] inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-6 flex flex-col items-center lg:items-end gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id} role="status"
          className="pointer-events-auto flex items-center gap-3 min-w-[16rem] max-w-sm rounded-lg bg-[#0f172a] text-white shadow-2xl ring-1 ring-white/10 pl-3 pr-2 py-2.5 animate-[toast-in_.25s_cubic-bezier(.2,.9,.3,1.2)]">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${TONE[t.tone].dot}`}>
            <Icon name={TONE[t.tone].icon} size={14} strokeWidth={2.4} />
          </span>
          <p className="text-sm flex-1">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10" aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
