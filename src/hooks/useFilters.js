import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { presetRange, todayISO } from '../utils/dates'

const DIMENSIONS = ['team', 'person', 'role', 'category', 'status', 'source']

// Filters live in the URL so a filtered view can be bookmarked or shared.
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
