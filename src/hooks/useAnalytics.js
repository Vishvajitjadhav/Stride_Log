import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useHolidays } from './useOrg'
import { usePeople } from './usePeople'
import { useTeams } from './useOrg'
import { previousRange, weekStartISO, addDaysISO, todayISO } from '../utils/dates'
import {
  applyFilters, summarize, compare, perPerson, perTeam, weeklyTrend,
  dailySeries, categoryMix, blockerFeed, inRange, notLoggedOn,
} from '../utils/metrics'

const TASK_COLS = 'id, user_id, team_id, role, date, title, status, priority, category, category_color, assigned_by, due_date, completed_on'
const LOG_COLS = 'user_id, team_id, role, date, submitted, blockers'

// Raw facts for a date window. RLS decides whose rows come back: employees
// only get their own, managers/HR/admins get everyone.
export function useFacts({ from, to, userId, teamId, enabled = true }) {
  return useQuery({
    queryKey: ['facts', from, to, userId ?? null, teamId ?? null],
    enabled: Boolean(enabled && from && to),
    queryFn: async () => {
      const scope = q => {
        q = q.gte('date', from).lte('date', to)
        if (userId) q = q.eq('user_id', userId)
        if (teamId) q = q.eq('team_id', teamId)
        return q
      }
      const [tasks, logs] = await Promise.all([
        fetchAll(() => scope(supabase.from('v_task_facts').select(TASK_COLS))),
        fetchAll(() => scope(supabase.from('v_log_facts').select(LOG_COLS))),
      ])
      return { tasks, logs }
    },
  })
}

// PostgREST caps responses (1000 rows by default) — page through.
async function fetchAll(build, pageSize = 1000) {
  const out = []
  for (let page = 0; ; page++) {
    const { data, error } = await build().order('date').range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < pageSize) return out
  }
}

// Everything a dashboard needs, computed from one fetch.
// filters: { from, to, compare: 'previous'|'none', team, person, role, category, status, source }
// self: restrict to one user (personal dashboard)
export function useDashboard(filters, { self } = {}) {
  const today = todayISO()
  const range = { from: filters.from, to: filters.to }
  const prev = previousRange(range)
  const trendFrom = addDaysISO(weekStartISO(range.to), -7 * 7)
  const fetchFrom = [range.from, prev.from, trendFrom].sort()[0]

  const holidaysQ = useHolidays()
  const peopleQ = usePeople({ enabled: !self })
  const teamsQ = useTeams()
  const factsQ = useFacts({
    from: fetchFrom,
    to: range.to,
    userId: self?.id ?? (filters.person && filters.person !== 'all' ? filters.person : undefined),
    teamId: filters.team && filters.team !== 'all' ? filters.team : undefined,
  })

  const data = useMemo(() => {
    if (!factsQ.data) return null
    const holidays = holidaysQ.data?.set ?? new Set()
    const on = v => v && v !== 'all'

    let people = self ? [self] : (peopleQ.data ?? [])
    if (on(filters.team)) people = people.filter(p => p.team_id === filters.team)
    if (on(filters.person)) people = people.filter(p => p.id === filters.person)
    if (on(filters.role)) people = people.filter(p => p.role === filters.role)

    // Only count active, approved people (deactivated staff drop out of stats).
    const ids = new Set(people.map(p => p.id))
    const filtered = applyFilters(factsQ.data, filters)
    const tasks = filtered.tasks.filter(t => ids.has(t.user_id))
    const logs = filtered.logs.filter(l => ids.has(l.user_id))
    const ctx = { tasks, logs, people, holidays, today }
    const peopleById = Object.fromEntries(people.map(p => [p.id, p]))

    const current = summarize({ ...ctx, range })
    const previous = summarize({ ...ctx, range: prev })
    const rangeTasks = inRange(tasks, range)

    return {
      range,
      prev,
      people,
      current,
      previous,
      growth: compare(current, previous),
      trend: weeklyTrend({ ...ctx, range }),
      daily: dailySeries(tasks, range),
      categories: categoryMix(rangeTasks),
      persons: self ? [] : perPerson({ ...ctx, range }),
      teams: self ? [] : perTeam({ ...ctx, teams: teamsQ.data ?? [], range }),
      blockers: blockerFeed({ tasks, logs, range, peopleById }),
      notLoggedToday: self ? [] : notLoggedOn(today, people, factsQ.data.logs, holidays),
      topDone: rangeTasks.filter(t => t.status === 'done').slice(-15).reverse()
        .map(t => ({ ...t, name: peopleById[t.user_id]?.name })),
      rangeTasks,
      rangeLogs: inRange(logs, range),
      holidays,
      categoryOptions: [...new Set(factsQ.data.tasks.map(t => t.category ?? 'Uncategorized'))].sort(),
    }
  }, [factsQ.data, holidaysQ.data, peopleQ.data, teamsQ.data, filters, self, today]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading: factsQ.isLoading || (!self && peopleQ.isLoading),
    error: factsQ.error,
    teams: teamsQ.data ?? [],
    allPeople: peopleQ.data ?? [],
  }
}
