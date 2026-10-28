import { useEffect, useRef, useState } from 'react'
import { PRESETS, formatRange } from '../utils/dates'
import { SOURCES } from '../hooks/useFilters'
import { useOrgSettings } from '../hooks/useOrg'
import Select from './ui/Select'
import Icon from './ui/Icon'

// Where the work came from, as one dropdown with a tick per source.
// At least one source always stays on.
function SourcePicker({ sources, value, onChange }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (e.key === 'Escape' || (e.type === 'mousedown' && !box.current?.contains(e.target))) setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  const on = sources.filter(s => value.includes(s.key))
  const label = on.length === sources.length ? 'All sources' : on.length === 1 ? `${on[0].label} only` : on.map(s => s.label).join(' and ')
  function toggle(key) {
    const next = value.includes(key) ? value.filter(s => s !== key) : [...value, key]
    if (next.some(s => sources.some(x => x.key === s))) onChange(next)
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open}
        className={`field !h-9 !py-0 !w-auto inline-flex items-center gap-2 ${on.length < sources.length ? '!border-primary-300 !text-primary-700' : ''}`}>
        <span className="whitespace-nowrap">{label}</span><Icon name="down" size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 left-0 min-w-48 rounded-xl border border-gray-200 bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(20_26_41/.25)]" role="group" aria-label="Show work from">
          {sources.map(s => (
            <label key={s.key} className="flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-gray-800 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={value.includes(s.key)} onChange={() => toggle(s.key)} className="w-4 h-4 accent-primary-600" />
              {s.label}
            </label>
          ))}
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-gray-500">At least one stays on.</p>
        </div>
      )}
    </div>
  )
}

// The one filter bar for Board, Calendar and Reports: Period, Employee,
// Project and Sources (StrideLog, Jira, Teams), all as compact dropdowns.
export default function FilterBar({ filters, setFilter, people = [], projects = [], showPeriod = true, showPerson = true, showProject = true, showSources = true, showRange = true }) {
  const { data: org } = useOrgSettings()
  // Jira and Teams only appear once the company has turned them on.
  const sources = SOURCES.filter(s => s.key === 'manual' || (s.key === 'jira' ? org?.jira_sync_enabled : org?.teams_sync_enabled))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showPeriod && <>
        <Select aria-label="Period" title={formatRange(filters.from, filters.to)} className="field !h-9 !py-0 !w-auto" value={filters.preset} onChange={e => setFilter({ preset: e.target.value })}>
          {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
        {filters.preset === 'custom' ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <input type="date" aria-label="From" className="field !h-9 !py-0 !w-auto" value={filters.from} max={filters.to}
              onChange={e => setFilter({ preset: 'custom', from: e.target.value, to: filters.to })} />
            <span>to</span>
            <input type="date" aria-label="To" className="field !h-9 !py-0 !w-auto" value={filters.to} min={filters.from}
              onChange={e => setFilter({ preset: 'custom', from: filters.from, to: e.target.value })} />
          </div>
        ) : showRange && filters.preset !== 'today' && (
          <span className="hidden 2xl:inline text-xs text-gray-500 whitespace-nowrap">{formatRange(filters.from, filters.to)}</span>
        )}
      </>}

      {showPerson && (
        <Select aria-label="Employee" className="field !h-9 !py-0 !w-auto max-w-52" value={filters.person} onChange={e => setFilter({ person: e.target.value })}>
          <option value="all">All employees</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}

      {showProject && projects.length > 0 && (
        <Select aria-label="Project" className="field !h-9 !py-0 !w-auto max-w-48" value={filters.project} onChange={e => setFilter({ project: e.target.value })}>
          <option value="all">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}

      {showSources && sources.length > 1 && (
        <SourcePicker sources={sources} value={filters.sources} onChange={v => setFilter({ sources: v })} />
      )}
    </div>
  )
}
