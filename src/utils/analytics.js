// Pure aggregation helpers for dashboards & team analytics.
// Kept side-effect free so they're easy to unit test (see test/utils/analytics.test.js).

const UNCATEGORIZED_COLOR = '#9ca3af'

export function taskCompletion(tasks = []) {
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  return { total, done, rate: total ? Math.round((done / total) * 100) : 0 }
}

// logs: [{ date, tasks: [{ status }] }] -> [{ date, total, done }] ascending by date
export function tasksPerDay(logs = []) {
  const byDate = new Map()
  logs.forEach(l => {
    if (!byDate.has(l.date)) byDate.set(l.date, { date: l.date, total: 0, done: 0 })
    const entry = byDate.get(l.date)
    ;(l.tasks ?? []).forEach(t => {
      entry.total++
      if (t.status === 'done') entry.done++
    })
  })
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
}

// tasks: [{ categories: { name, color } | null }] -> [{ name, color, count }] desc by count
export function categoryTotals(tasks = []) {
  const byName = new Map()
  tasks.forEach(t => {
    const name = t.categories?.name ?? 'Uncategorized'
    const color = t.categories?.color ?? UNCATEGORIZED_COLOR
    if (!byName.has(name)) byName.set(name, { name, color, count: 0 })
    byName.get(name).count++
  })
  return [...byName.values()].sort((a, b) => b.count - a.count)
}

// logs: [{ user_id, date, tasks }], profilesById: { [id]: { name, avatar_initials } }
// -> per-person rollup sorted by tasks done desc
export function perEmployee(logs = [], profilesById = {}) {
  const byUser = new Map()
  logs.forEach(l => {
    if (!byUser.has(l.user_id)) byUser.set(l.user_id, { userId: l.user_id, total: 0, done: 0, days: new Set() })
    const entry = byUser.get(l.user_id)
    entry.days.add(l.date)
    ;(l.tasks ?? []).forEach(t => {
      entry.total++
      if (t.status === 'done') entry.done++
    })
  })
  return [...byUser.values()]
    .map(e => {
      const profile = profilesById[e.userId] ?? {}
      return {
        userId: e.userId,
        name: profile.name ?? 'Unknown',
        avatar_initials: profile.avatar_initials,
        total: e.total,
        done: e.done,
        rate: e.total ? Math.round((e.done / e.total) * 100) : 0,
        days: e.days.size,
      }
    })
    .sort((a, b) => b.done - a.done)
}
