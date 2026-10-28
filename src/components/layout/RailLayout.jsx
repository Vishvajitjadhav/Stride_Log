import { useState } from 'react'
import Icon from '../ui/Icon'

// Page with a left rail (filters first, then side cards) and a wide main
// area. The rail stays in view while the page scrolls. Below 1024px the rail
// folds into one "Filters" button above the content.
//   rail:    the rail's content   summary: short text on the folded button
//   active:  how many filters are on (shown on the folded button)
export default function RailLayout({ rail, summary, active = 0, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="max-w-[120rem] mx-auto grid grid-cols-1 lg:grid-cols-[15.5rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)] gap-5 items-start">
      <aside className="space-y-4 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto scrollbar-none">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="lg:hidden w-full flex items-center justify-between gap-3 rounded-xl px-4 h-11 bg-primary-50 ring-1 ring-inset ring-primary-200 text-sm font-semibold text-primary-800 transition-colors active:bg-primary-100">
          <span className="flex items-center gap-2">
            <Icon name="filter" size={16} />Filters
            {active > 0 && <span className="text-[11px] rounded-full bg-primary-600 text-white px-2 py-0.5">{active} on</span>}
          </span>
          <span className="flex items-center gap-2 min-w-0 text-xs font-medium text-primary-700">
            <span className="truncate">{summary}</span>
            <Icon name="down" size={16} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <div className={`${open ? 'block' : 'hidden'} lg:block space-y-4`}>{rail}</div>
      </aside>
      <div className="@container min-w-0 space-y-4">{children}</div>
    </div>
  )
}

// The tinted filter card at the top of a rail. Active filters show a count
// and a "Clear all" link.
export function FilterPanel({ title = 'Filters', icon = 'filter', active = 0, onClear, children }) {
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-b from-primary-50 to-primary-50/40 ring-1 ring-inset ring-primary-200/80 space-y-3.5">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={16} className="text-primary-600" />
        <p className="text-sm font-semibold text-primary-800">{title}</p>
        {active > 0 && <span className="text-[11px] font-semibold rounded-full bg-primary-600 text-white px-2 py-0.5">{active} on</span>}
        {active > 0 && onClear && (
          <button type="button" onClick={onClear} className="ml-auto text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors">Clear all</button>
        )}
      </div>
      {children}
    </div>
  )
}

// A labelled block inside a FilterPanel.
export function RailField({ label, hint, children }) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700 mb-1.5">{label}</span>
      {children}
      {hint && <p className="text-[11px] text-primary-700/70 mt-1">{hint}</p>}
    </div>
  )
}

// Big, easy to hit choices stacked in the rail (views, periods, show).
//   options: [{ key, label, icon?, count? }]
export function RailChoices({ options, value, onChange, label }) {
  return (
    <div className="grid gap-1" role="group" aria-label={label}>
      {options.map(o => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            className={`flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-medium text-left transition-all duration-200 active:scale-[.98] ${on
              ? 'bg-primary-600 text-white shadow-[0_6px_14px_-8px_rgb(79_76_227/.9)]'
              : 'text-gray-700 hover:bg-surface hover:text-gray-900 hover:shadow-sm'}`}>
            {o.icon && <Icon name={o.icon} size={16} className={on ? 'text-white' : 'text-primary-500'} />}
            <span className="flex-1 truncate">{o.label}</span>
            {o.count != null && <span className={`text-xs tabular-nums ${on ? 'text-white/80' : 'text-gray-400'}`}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Search box for a rail; outlined in indigo while it narrows the list.
export function RailSearch({ value, onChange, placeholder, label = 'Search' }) {
  return (
    <div className="relative">
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        className={`field !h-9 !py-0 !pl-9 ${value.trim() ? '!border-primary-500 ring-2 ring-primary-100' : ''}`} />
    </div>
  )
}
