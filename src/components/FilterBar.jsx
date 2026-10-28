import { useEffect, useRef, useState } from 'react'
import { PRESETS, formatRange } from '../utils/dates'
import { SOURCES } from '../hooks/useFilters'
import { useOrgSettings } from '../hooks/useOrg'
import Select from './ui/Select'
import Icon from './ui/Icon'

// Where the work came from, as one dropdown with a tick per source.
// At least one source always stays on.
function SourcePicker({ sources, value, onChange, active }) {
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
        className={`field !h-9 !py-0 !w-auto inline-flex items-center gap-2 ${active ? ACTIVE : ''}`}>
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

// A filter that narrows the data turns solid indigo, so it is obvious the
// numbers are not the whole picture.
const ACTIVE = '!bg-primary-600 !text-white !border-primary-600 [&_svg]:!text-white/80'
const field = (active, extra = '') => `field !h-9 !py-0 ${extra} ${active ? ACTIVE : ''}`

// Sources as toggle pills (the stacked panel has room for them).
function SourcePills({ sources, value, onChange }) {
  function toggle(key) {
    const next = value.includes(key) ? value.filter(s => s !== key) : [...value, key]
    if (next.some(s => sources.some(x => x.key === s))) onChange(next)
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show work from">
      {sources.map(s => {
        const on = value.includes(s.key)
        return (
          <button key={s.key} type="button" aria-pressed={on} onClick={() => toggle(s.key)} title={on ? `Hide ${s.label} work` : `Show ${s.label} work`}
            className={`h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-95 ${on
              ? 'bg-primary-600 text-white shadow-[0_4px_12px_-6px_rgb(79_76_227/.8)] hover:bg-primary-700'
              : 'bg-surface text-gray-500 ring-1 ring-inset ring-gray-200 hover:text-gray-800 hover:ring-gray-300'}`}>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// The one set of filters for Board, Calendar and Reports: Period, Employee,
// Project and Sources (StrideLog, Jira, Teams).
//   panel: stacked, labelled and tinted (the Reports side rail); otherwise one
//          compact tinted row. children: extra controls such as a search box.
//   onClear / activeExtra: "Clear all" and extra active filters to count
export default function FilterBar({
  filters, setFilter, people = [], projects = [], panel = false, children, onClear, activeExtra = 0,
  showPeriod = true, showPerson = true, showProject = true, showSources = true,
}) {
  const { data: org } = useOrgSettings()
  // Jira and Teams only appear once the company has turned them on.
  const sources = SOURCES.filter(s => s.key === 'manual' || (s.key === 'jira' ? org?.jira_sync_enabled : org?.teams_sync_enabled))
  const sourcesNarrowed = sources.some(s => !filters.sources.includes(s.key))
  const active = Number(filters.person !== 'all') + Number(filters.project !== 'all') + Number(sourcesNarrowed) + activeExtra

  const period = showPeriod && (
    <>
      <Select aria-label="Period" title={formatRange(filters.from, filters.to)} className={field(false, panel ? '' : '!w-auto')}
        value={filters.preset} onChange={e => setFilter({ preset: e.target.value })}>
        {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </Select>
      {filters.preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <input type="date" aria-label="From" className="field !h-9 !py-0 !w-auto min-w-0 flex-1" value={filters.from} max={filters.to}
            onChange={e => setFilter({ preset: 'custom', from: e.target.value, to: filters.to })} />
          <span>to</span>
          <input type="date" aria-label="To" className="field !h-9 !py-0 !w-auto min-w-0 flex-1" value={filters.to} min={filters.from}
            onChange={e => setFilter({ preset: 'custom', from: filters.from, to: e.target.value })} />
        </div>
      )}
    </>
  )
  const person = showPerson && (
    <Select aria-label="Employee" className={field(filters.person !== 'all', panel ? '' : '!w-auto max-w-52')} value={filters.person} onChange={e => setFilter({ person: e.target.value })}>
      <option value="all">All employees</option>
      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  )
  const project = showProject && projects.length > 0 && (
    <Select aria-label="Project" className={field(filters.project !== 'all', panel ? '' : '!w-auto max-w-48')} value={filters.project} onChange={e => setFilter({ project: e.target.value })}>
      <option value="all">All projects</option>
      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  )
  const hasSources = showSources && sources.length > 1

  if (panel) {
    const label = 'block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700 mb-1.5'
    return (
      <div className="rounded-2xl p-4 bg-gradient-to-b from-primary-50 to-primary-50/40 ring-1 ring-inset ring-primary-200/80 space-y-3.5">
        <div className="flex items-center gap-2">
          <Icon name="filter" size={16} className="text-primary-600" />
          <p className="text-sm font-semibold text-primary-800">Filters</p>
          {active > 0 && <span className="text-[11px] font-semibold rounded-full bg-primary-600 text-white px-2 py-0.5">{active} on</span>}
          {active > 0 && onClear && (
            <button type="button" onClick={onClear} className="ml-auto text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors">Clear all</button>
          )}
        </div>
        {showPeriod && <div><span className={label}>Period</span><div className="space-y-2">{period}</div><p className="text-[11px] text-primary-700/70 mt-1">{formatRange(filters.from, filters.to)}</p></div>}
        {person && <div><span className={label}>Employee</span>{person}</div>}
        {project && <div><span className={label}>Project</span>{project}</div>}
        {hasSources && <div><span className={label}>Sources</span><SourcePills sources={sources} value={filters.sources} onChange={v => setFilter({ sources: v })} /></div>}
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl p-1.5 bg-primary-50/70 ring-1 ring-inset ring-primary-100">
      {period}
      {person}
      {project}
      {hasSources && <SourcePicker sources={sources} value={filters.sources} onChange={v => setFilter({ sources: v })} active={sourcesNarrowed} />}
      {children}
    </div>
  )
}
