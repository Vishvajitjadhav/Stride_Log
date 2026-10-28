import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { presetRange, todayISO } from '../utils/dates'

const DIMENSIONS = ['person', 'project']

// Where a task came from. 'manual' is anything typed into StrideLog.
export const SOURCES = [
  { key: 'manual', label: 'StrideLog' },
  { key: 'jira', label: 'Jira' },
  { key: 'teams', label: 'Teams' },
]
const ALL_SOURCES = SOURCES.map(s => s.key)

// Filters live in the URL so a filtered view can be bookmarked or shared.
//   { preset, from, to, person, project, sources: ['manual', 'jira', 'teams'] }
export function useFilters(defaultPreset = 'this_week') {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const preset = params.get('preset') || defaultPreset
    const range = preset === 'custom'
      ? { from: params.get('from') || todayISO(), to: params.get('to') || todayISO() }
      : presetRange(preset) ?? presetRange(defaultPreset)
    const out = { preset, ...range }
    DIMENSIONS.forEach(d => { out[d] = params.get(d) || 'all' })
    const src = params.get('src')?.split(',').filter(s => ALL_SOURCES.includes(s))
    out.sources = src?.length ? src : ALL_SOURCES
    return out
  }, [params, defaultPreset])

  function setFilter(patch) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (k === 'sources') {
        if (!v?.length || ALL_SOURCES.every(s => v.includes(s))) next.delete('src')
        else next.set('src', v.join(','))
      } else if (v === undefined || v === null || v === '' || v === 'all') next.delete(k)
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

// Keep only tasks from the chosen sources (tasks without a source are StrideLog ones).
export function bySource(tasks, sources) {
  if (!sources || sources.length === ALL_SOURCES.length) return tasks
  return tasks.filter(t => sources.includes(t.source ?? 'manual'))
}

// How many filters narrow the data (employee, project, sources).
export function activeCount(filters) {
  return Number(filters.person !== 'all') + Number(filters.project !== 'all') + Number(filters.sources.length < ALL_SOURCES.length)
}
