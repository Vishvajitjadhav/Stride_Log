import { PRESETS } from '../utils/dates'
import { SOURCES } from '../hooks/useFilters'
import { useOrgSettings } from '../hooks/useOrg'
import Select from './ui/Select'

const QUICK = ['today', 'this_week', 'this_month']

// The one filter bar for Board, Calendar and Reports:
// When (Today, This week, This month, or More), where the work came from
// (StrideLog, Jira, Teams), Employee and Project.
export default function FilterBar({ filters, setFilter, people = [], projects = [], showPerson = true, showProject = true, showSources = true }) {
  const { data: org } = useOrgSettings()
  // Jira and Teams only appear once the company has turned them on.
  const sources = SOURCES.filter(s => s.key === 'manual' || (s.key === 'jira' ? org?.jira_sync_enabled : org?.teams_sync_enabled))
  const quick = QUICK.includes(filters.preset)

  function toggleSource(key) {
    const on = filters.sources.includes(key)
    const next = on ? filters.sources.filter(s => s !== key) : [...filters.sources, key]
    if (next.some(s => sources.some(x => x.key === s))) setFilter({ sources: next })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="segmented" role="group" aria-label="Period">
        {QUICK.map(k => (
          <button key={k} type="button" aria-pressed={filters.preset === k} onClick={() => setFilter({ preset: k })}>
            {PRESETS.find(p => p.key === k).label}
          </button>
        ))}
      </div>

      <Select aria-label="More periods" className={`field !h-9 !py-0 !w-auto ${quick ? 'text-gray-500' : ''}`}
        value={quick ? '' : filters.preset} onChange={e => e.target.value && setFilter({ preset: e.target.value })}>
        <option value="">More periods</option>
        {PRESETS.filter(p => !QUICK.includes(p.key)).map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </Select>

      {filters.preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <input type="date" aria-label="From" className="field !h-9 !py-0 !w-auto" value={filters.from} max={filters.to}
            onChange={e => setFilter({ preset: 'custom', from: e.target.value, to: filters.to })} />
          <span>to</span>
          <input type="date" aria-label="To" className="field !h-9 !py-0 !w-auto" value={filters.to} min={filters.from}
            onChange={e => setFilter({ preset: 'custom', from: filters.from, to: e.target.value })} />
        </div>
      )}

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
        <div className="flex items-center gap-1.5" role="group" aria-label="Show work from">
          {sources.map(s => {
            const on = filters.sources.includes(s.key)
            return (
              <button key={s.key} type="button" aria-pressed={on} onClick={() => toggleSource(s.key)}
                title={on ? `Hide ${s.label} work` : `Show ${s.label} work`}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium ring-1 ring-inset transition-colors ${on ? 'bg-primary-50 text-primary-700 ring-primary-200' : 'text-gray-500 ring-gray-200 hover:bg-gray-50'}`}>
                <span className={`w-2 h-2 rounded-full ${on ? 'bg-primary-500' : 'bg-gray-300'}`} aria-hidden="true" />{s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
