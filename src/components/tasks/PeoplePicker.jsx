import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'

// Choose one or more people (assigning the same task to several at once).
//   people: [{ id, name, ... }]   value: [id]   me: your id ("Myself" first)
export default function PeoplePicker({ id, people, value, onChange, me }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef(null)
  const menu = useRef(null)
  const [pos, setPos] = useState(null)
  // The list floats above the page (fixed), so sheets and cards never clip it.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = box.current.getBoundingClientRect()
      const width = Math.max(r.width, 256)
      const left = Math.min(r.left, window.innerWidth - width - 8)
      const below = window.innerHeight - r.bottom - 12
      setPos(below >= 260 || below >= r.top ? { left, width, top: r.bottom + 6, maxHeight: below } : { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: r.top - 12 })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const outside = e => { if (!box.current?.contains(e.target) && !menu.current?.contains(e.target)) setOpen(false) }
    // Escape closes just this list, not the sheet around it (caught first, then stopped).
    const escape = e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', outside)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('mousedown', outside); window.removeEventListener('keydown', escape, true) }
  }, [open])

  const name = p => (p.id === me ? 'Myself' : p.name)
  const ordered = [...people].sort((a, b) => Number(b.id === me) - Number(a.id === me) || a.name.localeCompare(b.name))
  const q = query.trim().toLowerCase()
  const shown = ordered.filter(p => !q || p.name.toLowerCase().includes(q))
  const chosen = ordered.filter(p => value.includes(p.id))
  const allShown = shown.length > 0 && shown.every(p => value.includes(p.id))
  const label = chosen.length === 0 ? 'Choose people'
    : chosen.length === 1 ? name(chosen[0])
    : `${name(chosen[0])} and ${chosen.length - 1} more`

  const toggle = pid => onChange(value.includes(pid) ? value.filter(x => x !== pid) : [...value, pid])
  const toggleShown = () => onChange(allShown
    ? value.filter(x => !shown.some(p => p.id === x))
    : [...new Set([...value, ...shown.map(p => p.id)])])

  return (
    <div ref={box} className="relative">
      <button id={id} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open}
        className={`field !flex items-center justify-between gap-2 text-left ${open ? '!border-primary-400 ring-4 ring-primary-100' : ''}`}>
        <span className={`truncate ${chosen.length ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {chosen.length > 1 && <span className="text-[11px] font-semibold rounded-full bg-primary-600 text-white px-1.5">{chosen.length}</span>}
          <Icon name="down" size={16} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180 text-primary-500' : ''}`} />
        </span>
      </button>

      {open && pos && createPortal(
        <div ref={menu} style={pos} className="fixed z-[60] card !rounded-xl p-1.5 flex flex-col menu-in shadow-[0_18px_40px_-12px_rgb(20_26_41/.25)]" role="group" aria-label="People">
          <div className="p-1 pb-1.5">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people"
              className="w-full h-9 rounded-lg bg-gray-50 border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100" />
          </div>
          {shown.length > 1 && (
            <button type="button" onClick={toggleShown} className="w-full text-left px-3 py-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800">
              {allShown ? 'Clear these' : q ? `Select all ${shown.length} shown` : `Select all ${shown.length}`}
            </button>
          )}
          <ul className="min-h-0 flex-1 max-h-64 overflow-y-auto overscroll-contain">
            {shown.map(p => {
              const on = value.includes(p.id)
              return (
                <li key={p.id}>
                  <label className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none transition-colors ${on ? 'bg-primary-50 text-primary-800' : 'text-gray-800 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="w-4 h-4 accent-primary-600" />
                    <Avatar person={p} size="xs" />
                    <span className="flex-1 truncate">{name(p)}</span>
                  </label>
                </li>
              )
            })}
            {!shown.length && <li className="px-3 py-2 text-sm text-gray-400">No matches</li>}
          </ul>
          {chosen.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 mt-1 px-3 pt-2 pb-1">
              <span className="text-xs text-gray-500">{chosen.length} chosen, each gets their own copy</span>
              <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-primary-700 hover:text-primary-800">Done</button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
