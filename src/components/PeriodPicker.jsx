import { PRESETS } from '../utils/dates'

// Period chips (This week, Last week, ...) + custom dates; extra controls on the right.
export default function PeriodPicker({ filters, setFilter, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => setFilter({ preset: p.key })} aria-pressed={filters.preset === p.key}
            className={`chip ${filters.preset === p.key ? 'chip-active' : ''}`}>
            {p.label}
          </button>
        ))}
      </div>
      {filters.preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <input type="date" className="field !w-auto !h-8 !py-0" value={filters.from} max={filters.to}
            onChange={e => setFilter({ preset: 'custom', from: e.target.value, to: filters.to })} aria-label="From" />
          to
          <input type="date" className="field !w-auto !h-8 !py-0" value={filters.to} min={filters.from}
            onChange={e => setFilter({ preset: 'custom', from: filters.from, to: e.target.value })} aria-label="To" />
        </div>
      )}
      <div className="flex-1" />
      {children}
    </div>
  )
}
