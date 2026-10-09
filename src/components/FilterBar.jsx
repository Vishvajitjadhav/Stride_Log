import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PRESETS, presetRange, todayISO, formatRange } from '../utils/dates'
import { ROLES, ROLE_LABELS } from '../lib/permissions'
import { STATUS_LABELS } from '../lib/labels'
import Icon from './ui/Icon'

const DIMENSIONS = ['team', 'person', 'role', 'category', 'status', 'source']

// Filters live in the URL so a filtered view can be bookmarked or shared.
// eslint-disable-next-line react-refresh/only-export-components
export function useFilters(defaultPreset = 'this_week') {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const preset = params.get('preset') || defaultPreset
    const range = preset === 'custom'
      ? { from: params.get('from') || todayISO(), to: params.get('to') || todayISO() }
      : presetRange(preset) ?? presetRange(defaultPreset)
    const out = { preset, ...range }
    DIMENSIONS.forEach(d => { out[d] = params.get(d) || 'all' })
    return out
  }, [params, defaultPreset])

  function setFilter(patch) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    })
    if (patch.preset && patch.preset !== 'custom') { next.delete('from'); next.delete('to') }
    setParams(next, { replace: true })
  }

  function reset() {
    setParams({}, { replace: true })
  }

  return { filters, setFilter, reset }
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="label !mb-0">{label}</span>
      <select className="field !py-1.5" value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </label>
  )
}

// show: which dimension controls to render, e.g. ['team','person','category']
export default function FilterBar({ filters, setFilter, reset, show = [], teams = [], people = [], categories = [], actions }) {
  const [open, setOpen] = useState(false)
  const activeCount = show.filter(d => filters[d] && filters[d] !== 'all').length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 flex-1">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setFilter({ preset: p.key })}
              className={`chip ${filters.preset === p.key ? 'chip-active' : ''}`}>
              {p.label}
            </button>
          ))}
        </div>
        {show.length > 0 && (
          <button onClick={() => setOpen(o => !o)} className={`chip flex items-center gap-1.5 shrink-0 ${activeCount ? '!border-primary-400 !text-primary-700' : ''}`}>
            <Icon name="filter" size={14} /> Filters{activeCount ? ` · ${activeCount}` : ''}
          </button>
        )}
        {actions}
      </div>

      {filters.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" className="field !w-auto !py-1.5" value={filters.from} max={filters.to}
            onChange={e => setFilter({ preset: 'custom', from: e.target.value, to: filters.to })} aria-label="From" />
          <span className="text-gray-400">→</span>
          <input type="date" className="field !w-auto !py-1.5" value={filters.to} min={filters.from}
            onChange={e => setFilter({ preset: 'custom', from: filters.from, to: e.target.value })} aria-label="To" />
        </div>
      )}

      {open && show.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {show.includes('team') && (
            <Select label="Team" value={filters.team} onChange={v => setFilter({ team: v })}>
              <option value="all">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
          {show.includes('person') && (
            <Select label="Person" value={filters.person} onChange={v => setFilter({ person: v })}>
              <option value="all">Everyone</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          {show.includes('role') && (
            <Select label="Role" value={filters.role} onChange={v => setFilter({ role: v })}>
              <option value="all">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          )}
          {show.includes('category') && (
            <Select label="Category" value={filters.category} onChange={v => setFilter({ category: v })}>
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          )}
          {show.includes('status') && (
            <Select label="Status" value={filters.status} onChange={v => setFilter({ status: v })}>
              <option value="all">Any status</option>
              {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          )}
          {show.includes('source') && (
            <Select label="Source" value={filters.source} onChange={v => setFilter({ source: v })}>
              <option value="all">All tasks</option>
              <option value="assigned">Assigned</option>
              <option value="self">Self-created</option>
            </Select>
          )}
          <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex justify-end">
            <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-800">Reset all filters</button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">{formatRange(filters.from, filters.to)}</p>
    </div>
  )
}
