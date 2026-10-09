import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { toISO, previousRange, weekStartISO, addDaysISO, todayISO } from '../../utils/dates'
import {
  summarize, compare, perPerson, perTeam, weeklyTrend, dailySeries, categoryMix, blockerFeed, inRange,
} from '../../utils/metrics'

// Selectable periods for the dialog: last 8 weeks / last 12 months.
export function periodOptions(kind, ref = new Date()) {
  if (kind === 'weekly') {
    return Array.from({ length: 8 }, (_, i) => {
      const d = subWeeks(ref, i)
      const from = toISO(startOfWeek(d, { weekStartsOn: 1 }))
      const to = toISO(endOfWeek(d, { weekStartsOn: 1 }))
      const label = i === 0 ? 'This week' : i === 1 ? 'Last week' : `Week of ${format(parseISO(from), 'd MMM')}`
      return { from, to, label: `${label} (${format(parseISO(from), 'd MMM')} – ${format(parseISO(to), 'd MMM')})` }
    })
  }
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(ref, i)
    return { from: toISO(startOfMonth(d)), to: toISO(endOfMonth(d)), label: format(d, 'MMMM yyyy') }
  })
}

async function all(build) {
  const out = []
  for (let page = 0; ; page++) {
    const { data, error } = await build().order('date').range(page * 1000, page * 1000 + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

// scope: { kind: 'me'|'person'|'team'|'company', userId?, teamId? }
export async function buildReportData({ kind, range, scope, generatedBy }) {
  const today = todayISO()
  const prev = previousRange(range)
  const trendFrom = addDaysISO(weekStartISO(range.to), -7 * 7)
  const fetchFrom = [range.from, prev.from, trendFrom].sort()[0]

  const scopeQ = q => {
    q = q.gte('date', fetchFrom).lte('date', range.to)
    if (scope.userId) q = q.eq('user_id', scope.userId)
    if (scope.teamId) q = q.eq('team_id', scope.teamId)
    return q
  }

  const [org, holidaysRes, peopleRes, teamsRes, tasks, logs] = await Promise.all([
    supabase.from('org_settings').select('*').eq('id', 1).single(),
    supabase.from('holidays').select('date, name'),
    supabase.from('profiles').select('id, name, role, team_id, created_at, avatar_initials').eq('is_approved', true).eq('is_active', true).order('name'),
    supabase.from('teams').select('id, name').order('name'),
    all(() => scopeQ(supabase.from('v_task_facts').select('*'))),
    all(() => scopeQ(supabase.from('v_log_facts').select('*'))),
  ])
  for (const r of [org, holidaysRes, peopleRes, teamsRes]) if (r.error) throw r.error

  const holidays = new Set((holidaysRes.data ?? []).map(h => h.date))
  let people = peopleRes.data ?? []
  if (scope.userId) people = people.filter(p => p.id === scope.userId)
  if (scope.teamId) people = people.filter(p => p.team_id === scope.teamId)
  const ids = new Set(people.map(p => p.id))
  const t = tasks.filter(x => ids.has(x.user_id))
  const l = logs.filter(x => ids.has(x.user_id))
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]))
  const ctx = { tasks: t, logs: l, people, holidays, today }

  const current = summarize({ ...ctx, range })
  const previous = summarize({ ...ctx, range: prev })
  const rangeTasks = inRange(t, range)

  const scopeName =
    scope.kind === 'me' || scope.kind === 'person' ? (people[0]?.name ?? 'Unknown')
    : scope.kind === 'team' ? (teamsRes.data.find(x => x.id === scope.teamId)?.name ?? 'Team')
    : (org.data.company_name || 'Company')

  return {
    org: org.data,
    kind,
    scope: { ...scope, name: scopeName },
    range,
    prev,
    generatedAt: new Date(),
    generatedBy,
    current,
    growth: compare(current, previous),
    previousOnTimeBase: previous.onTimeBase,
    daily: kind === 'weekly' ? dailySeries(t, range) : null,
    trend: weeklyTrend({ ...ctx, range }),
    categories: categoryMix(rangeTasks),
    persons: people.length > 1 ? perPerson({ ...ctx, range }) : [],
    teams: scope.kind === 'company' ? perTeam({ ...ctx, teams: teamsRes.data ?? [], range }) : [],
    blockers: blockerFeed({ tasks: t, logs: l, range, peopleById }, 12),
    highlights: rangeTasks.filter(x => x.status === 'done').slice(-12).reverse()
      .map(x => ({ ...x, name: peopleById[x.user_id]?.name })),
    holidaysInRange: (holidaysRes.data ?? []).filter(h => h.date >= range.from && h.date <= range.to),
  }
}

export function reportFileName(data) {
  const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
  const kind = data.kind === 'weekly' ? 'Weekly' : 'Monthly'
  return `${slug(data.org.company_name || 'StrideLog')}_${kind}_Report_${slug(data.scope.name)}_${data.range.from}_to_${data.range.to}.pdf`
}
