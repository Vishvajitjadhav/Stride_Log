import { useId, useState, useRef, useEffect } from 'react'

// Small ⓘ that explains a term. Works with hover, keyboard focus and tap.
export default function Tooltip({ text, className = '', align = 'center' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const pos = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="What does this mean?"
        aria-describedby={open ? id : undefined}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full border border-gray-300 text-[10px] leading-none font-semibold text-gray-400 hover:text-gray-700 hover:border-gray-400 inline-flex items-center justify-center"
      >
        i
      </button>
      {open && (
        <span id={id} role="tooltip"
          className={`menu-in absolute z-50 top-6 ${pos} w-60 rounded-md bg-[#0f172a] ring-1 ring-white/10 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg normal-case tracking-normal text-left`}>
          {text}
        </span>
      )}
    </span>
  )
}
