import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useHolidays } from './useOrg'
import { usePeople } from './usePeople'
import { useProjects } from './useProjects'
import { previousRange, weekStartISO, addDaysISO, todayISO, compareLabel } from '../utils/dates'
import { summarize, compare, perPerson, perProject, trend, bucketSize, inRange } from '../utils/metrics'
import { lastWeeks, weeklyDone, trendLabel } from '../utils/insights'
import { isTracked } from '../lib/permissions'
import { bySource } from './useFilters'

const TASK_COLS = 'id, user_id, role, date, title, status, category, category_color, assigned_by, due_date, completed_on, project_id, project, source, description, external_id, external_url, changed_at'
const LOG_COLS = 'user_id, role, date, submitted, blockers, summary'

// PostgREST caps responses (1000 rows by default), so page through.
async function fetchAll(build, pageSize = 1000) {
  const out = []
  for (let page = 0; ; page++) {
    const { data, error } = await build().order('date').range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < pageSize) return out
  }
}

// Raw facts for a date window. RLS decides whose rows come back: employees
// only get their own, managers/HR/admins get everyone.
export function useFacts({ from, to, userId, enabled = true }) {
  return useQuery({
    queryKey: ['facts', from, to, userId ?? null],
    enabled: Boolean(enabled && from && to),
    // Keep showing the last numbers while a new period loads, so changing a
    // filter dims the page for a moment instead of flashing empty boxes.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const scope = q => {
        q = q.gte('date', from).lte('date', to)
        return userId ? q.eq('user_id', userId) : q
      }
      const [tasks, logs] = await Promise.all([
        fetchAll(() => scope(supabase.from('v_task_facts').select(TASK_COLS))),
        fetchAll(() => scope(supabase.from('v_log_facts').select(LOG_COLS))),
      ])
      return { tasks, logs }
    },
  })
}

// Everything everyone worked on for one day: tasks planned for that day plus
// earlier tasks finished that day, and each person's daily log.
export function useDayFacts(date) {
  return useQuery({
    queryKey: ['facts', 'day', date],
    enabled: Boolean(date),
    queryFn: async () => {
      const [t, l] = await Promise.all([
        supabase.from('v_task_facts').select(TASK_COLS).or(`date.eq.${date},completed_on.eq.${date}`).order('date'),
        supabase.from('v_log_facts').select(LOG_COLS).eq('date', date),
      ])
      if (t.error) throw t.error
      if (l.error) throw l.error
      return { tasks: t.data, logs: l.data }
    },
  })
}

// Everything a report screen needs, computed from one fetch.
//   filters: { preset, from, to, person: id|'all', project: id|'all', sources? }
//   self:    a single profile (personal pages); skips the people directory
export function useDashboard(filters, { self } = {}) {
  const today = todayISO()
  const range = { from: filters.from, to: filters.to }
  const prev = previousRange(range)
  const trendFrom = bucketSize(range) === 'week' ? addDaysISO(weekStartISO(range.to), -7 * 7) : range.from
  const fetchFrom = [range.from, prev.from, trendFrom].sort()[0]
  const person = filters.person && filters.person !== 'all' ? filters.person : null
  const projectId = filters.project && filters.project !== 'all' ? filters.project : null
  const sources = filters.sources?.join(',')

  const holidaysQ = useHolidays()
  const peopleQ = usePeople({ enabled: !self })
  const projectsQ = useProjects()
  const factsQ = useFacts({ from: fetchFrom, to: range.to, userId: self?.id ?? person ?? undefined })

  const data = useMemo(() => {
    if (!factsQ.data || (!self && !peopleQ.data)) return null
    const holidays = holidaysQ.data?.set ?? new Set()
    const projects = projectsQ.data ?? []
    const project = projects.find(p => p.id === projectId) ?? null

    // Who is analysed: employees and BAs (logging is optional for managers,
    // HR and admins), narrowed by the employee and project filters.
    let people = self ? [self] : (peopleQ.data ?? []).filter(isTracked)
    if (person) people = (peopleQ.data ?? []).filter(p => p.id === person)
    if (project) {
      const members = new Set(project.members.map(m => m.user_id))
      people = people.filter(p => members.has(p.id))
    }
    const allTasks = bySource(factsQ.data.tasks, sources?.split(','))
    const ids = new Set(people.map(p => p.id))
    let tasks = allTasks.filter(t => ids.has(t.user_id))
    if (project) tasks = tasks.filter(t => t.project_id === project.id)
    const logs = factsQ.data.logs.filter(l => ids.has(l.user_id))

    const ctx = { tasks, logs, people, holidays, today }
    const current = summarize({ ...ctx, range })
    const previous = summarize({ ...ctx, range: prev })

    // Project cards: the same people as the rest of the report (employees and
    // BAs, or the one selected), across every project or just the selected one.
    const tracked = new Set((self ? [self] : person ? people : (peopleQ.data ?? []).filter(isTracked)).map(p => p.id))
    const projectTasks = allTasks.filter(t => tracked.has(t.user_id))
    const scoped = (project ? [project] : projects)
      .map(p => ({ ...p, members: p.members.filter(m => person ? m.user_id === person : tracked.has(m.user_id)) }))
      .filter(p => !person || p.members.length)
    // Each person and project against their own last 3 weeks. A week still
    // under way would look like a drop, so it waits until the week is over.
    const weeks = lastWeeks(range.to < weekStartISO(today) ? range.to : addDaysISO(weekStartISO(today), -1), 3)
    const withTrend = (row, rows) => {
      const series = weeklyDone(rows, weeks)
      return { ...row, series, trend: trendLabel(series) }
    }
    const projectRows = perProject({ tasks: projectTasks, projects: scoped, range, today, holidays })
      .map(p => withTrend(p, projectTasks.filter(t => t.project_id === p.id)))

    return {
      range,
      prev,
      against: compareLabel(filters.preset),
      people,
      project,
      current,
      previous,
      growth: compare(current, previous),
      trend: trend({ ...ctx, range }),
      persons: perPerson({ ...ctx, range }).map(p => withTrend(p, tasks.filter(t => t.user_id === p.id))),
      tasks: inRange(tasks, range),
      weeks,
      projects: projectRows,
    }
  }, [factsQ.data, holidaysQ.data, peopleQ.data, projectsQ.data, filters.preset, range.from, range.to, person, projectId, sources, self, today]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading: factsQ.isLoading || (!self && peopleQ.isLoading),
    isFetching: factsQ.isFetching,
    error: factsQ.error,
    allPeople: (peopleQ.data ?? []).filter(isTracked),
    projects: projectsQ.data ?? [],
  }
}
