import { PRESETS } from '../utils/dates'
import Select from './ui/Select'

// Three plain dropdowns: Period, Employee, Project (+ dates for "Custom").
export default function ReportFilters({ filters, setFilter, people = [], projects = [], showPerson = true, showProject = true }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="label !mb-0">Period</span>
        <Select className="field !h-9 !py-0 !w-44" value={filters.preset} onChange={e => setFilter({ preset: e.target.value })}>
          {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
      </label>

      {filters.preset === 'custom' && (
        <div className="flex items-end gap-2 text-sm text-gray-500">
          <label className="flex flex-col gap-1">
            <span className="label !mb-0">From</span>
            <input type="date" className="field !h-9 !py-0 !w-auto" value={filters.from} max={filters.to}
              onChange={e => setFilter({ preset: 'custom', from: e.target.value, to: filters.to })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label !mb-0">To</span>
            <input type="date" className="field !h-9 !py-0 !w-auto" value={filters.to} min={filters.from}
              onChange={e => setFilter({ preset: 'custom', from: filters.from, to: e.target.value })} />
          </label>
        </div>
      )}

      {showPerson && (
        <label className="flex flex-col gap-1">
          <span className="label !mb-0">Employee</span>
          <Select className="field !h-9 !py-0 !w-52" value={filters.person} onChange={e => setFilter({ person: e.target.value })}>
            <option value="all">All employees</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
      )}

      {showProject && projects.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="label !mb-0">Project</span>
          <Select className="field !h-9 !py-0 !w-48" value={filters.project} onChange={e => setFilter({ project: e.target.value })}>
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
      )}
    </div>
  )
}
