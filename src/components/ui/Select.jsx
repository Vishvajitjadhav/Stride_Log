import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// Styled replacement for <select>: same props (value, onChange(e) with
// e.target.value, <option> children, id, disabled, aria-label), but the open
// list is a rounded card that matches the app instead of the browser's box.
// The list is portalled and fixed, so it is never clipped by sheets or cards.

const SEARCH_FROM = 10 // show a search box when there are this many options

function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf(node.props.children)
  return ''
}

function readOptions(children, out = []) {
  Children.forEach(children, child => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) return readOptions(child.props.children, out)
    if (child.type === 'option') {
      const label = textOf(child.props.children)
      out.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) })
    }
  })
  return out
}

export default function Select({ value, onChange, children, className = '', id, disabled = false, 'aria-label': ariaLabel, title }) {
  const options = useMemo(() => readOptions(children), [children])
  const current = String(value ?? '')
  const selected = options.find(o => o.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState(null)
  const button = useRef(null)
  const list = useRef(null)
  const search = useRef(null)
  const typed = useRef({ text: '', at: 0 })
  const listId = useId()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  function place() {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const room = window.innerHeight - r.bottom - 12
    const up = room < 220 && r.top > room
    const maxHeight = Math.min(360, Math.max(160, up ? r.top - 12 : room))
    const width = Math.max(r.width, 200)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPos({ left: Math.max(8, left), width, maxHeight, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) })
  }

  function openList() {
    if (disabled) return
    place()
    setQuery('')
    setActive(Math.max(0, options.findIndex(o => o.value === current)))
    setOpen(true)
  }

  function choose(o) {
    if (!o || o.disabled) return
    setOpen(false)
    button.current?.focus()
    if (o.value !== current) onChange?.({ target: { value: o.value } })
  }

  // Keep the list attached to the button; close on outside press.
  useLayoutEffect(() => {
    if (!open) return
    const onDown = e => {
      if (!button.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false)
    }
    const onMove = e => { if (!list.current?.contains(e.target)) place() }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (options.length >= SEARCH_FROM) search.current?.focus({ preventScroll: true })
    else list.current?.focus({ preventScroll: true })
  }, [open, options.length])

  // Keep the highlighted row in view.
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function move(step) {
    if (!shown.length) return
    let i = active
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length
      if (!shown[i].disabled) break
    }
    setActive(i)
  }

  function onKey(e) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1) }
    else if (e.key === 'Enter' || (e.key === ' ' && e.target !== search.current)) { e.preventDefault(); choose(shown[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); button.current?.focus() }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1 && e.target !== search.current) {
      // Type ahead: jump to the first option starting with the typed letters.
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const i = shown.findIndex(o => o.label.toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <>
      <button ref={button} type="button" id={id} disabled={disabled} title={title}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}
        className={`field !flex items-center justify-between gap-2 text-left ${open ? '!border-primary-400 ring-4 ring-primary-100' : ''} ${className}`}>
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>{selected?.label ?? 'Choose'}</span>
        <Icon name="down" size={16} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180 text-primary-500' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={ariaLabel} onKeyDown={onKey}
          aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
          className="fixed z-[60] card !rounded-xl p-1.5 flex flex-col menu-in outline-none shadow-[0_18px_40px_-12px_rgb(20_26_41/.25)]"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight, transformOrigin: pos.bottom ? 'bottom' : 'top' }}>
          {options.length >= SEARCH_FROM && (
            <div className="p-1 pb-1.5">
              <input ref={search} value={query} onChange={e => { setQuery(e.target.value); setActive(0) }} placeholder="Search"
                className="w-full h-9 rounded-lg bg-gray-50 border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100" />
            </div>
          )}
          <div className="overflow-y-auto overscroll-contain">
            {shown.map((o, i) => {
              const isSel = o.value === current
              return (
                <div key={o.value} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}
                  onPointerMove={() => !o.disabled && setActive(i)} onClick={() => choose(o)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                    o.disabled ? 'opacity-40 cursor-not-allowed' : i === active ? 'bg-primary-50 text-primary-700' : 'text-gray-700'} ${isSel ? 'font-semibold' : ''}`}>
                  <span className="flex-1 truncate">{o.label}</span>
                  {isSel && <Icon name="check" size={15} strokeWidth={2.4} className="text-primary-600" />}
                </div>
              )
            })}
            {!shown.length && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
