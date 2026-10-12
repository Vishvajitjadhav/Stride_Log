import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { toISO, previousRange, weekStartISO, addDaysISO, todayISO, daysBetween, isWorkingDay } from '../../utils/dates'
import { summarize, compare, perPerson, trend, categoryMix, inRange, observations } from '../../utils/metrics'
import { isTracked } from '../../lib/permissions'

// Selectable periods for the dialog: last 8 weeks / last 12 months.
export function periodOptions(kind, ref = new Date()) {
  if (kind === 'weekly') {
    return Array.from({ length: 8 }, (_, i) => {
      const d = subWeeks(ref, i)
      const from = toISO(startOfWeek(d, { weekStartsOn: 1 }))
      const to = toISO(endOfWeek(d, { weekStartsOn: 1 }))
      const name = i === 0 ? 'This week' : i === 1 ? 'Last week' : `Week of ${format(parseISO(from), 'd MMM')}`
      return { from, to, label: `${name}, ${format(parseISO(from), 'd MMM')} to ${format(parseISO(to), 'd MMM')}` }
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

// Day by day detail for one person (weekly report).
function dayRows(person, tasks, logs, range, holidays, holidayNames, nameById, today) {
  return daysBetween(range.from, range.to).map(d => {
    const log = logs.find(l => l.date === d)
    const working = isWorkingDay(d, holidays)
    const dayTasks = tasks.filter(t => t.date === d)
    let state
    if (log?.submitted) state = working ? 'Submitted' : 'Extra day'
    else if (d > today) state = 'Upcoming'
    else if (!working) state = holidayNames[d] ? `Holiday: ${holidayNames[d]}` : 'Weekend'
    else if (d === today) state = 'In progress'
    else state = 'Not submitted'
    return {
      date: d,
      working,
      state,
      summary: log?.summary ?? null,
      blockers: log?.blockers ?? null,
      tasks: dayTasks.map(t => ({
        id: t.id,
        title: t.title,
        category: t.category ?? 'Uncategorized',
        status: t.status,
        completed_on: t.completed_on,
        assignedBy: t.assigned_by ? (nameById[t.assigned_by] ?? 'Manager') : null,
      })),
    }
  }).filter(r => r.working || r.tasks.length || r.state === 'Extra day' || r.state.startsWith('Holiday'))
}

// Week by week detail for one person (monthly report).
function weekRows(person, tasks, logs, range, holidays, today) {
  const out = []
  for (let ws = weekStartISO(range.from); ws <= range.to; ws = addDaysISO(ws, 7)) {
    const r = { from: ws < range.from ? range.from : ws, to: addDaysISO(ws, 6) > range.to ? range.to : addDaysISO(ws, 6) }
    const s = summarize({ tasks, logs, people: [person], range: r, holidays, today })
    out.push({ ...r, planned: s.planned, done: s.done, completionRate: s.completionRate, loggedDays: s.loggedDays, expectedDays: s.expectedDays, blocked: s.blocked })
  }
  return out
}

// Pure: turn raw rows into everything the PDF shows. Exported for tests.
export function shapeReport({ kind, range, scope, org, people, allProfiles, projects = [], holidayRows, tasks, logs, generatedBy, today = todayISO() }) {
  const prev = previousRange(range)
  const holidays = new Set(holidayRows.map(h => h.date))
  const holidayNames = Object.fromEntries(holidayRows.map(h => [h.date, h.name]))
  const nameById = Object.fromEntries(allProfiles.map(p => [p.id, p.name]))
  const project = projects.find(p => p.id === scope.projectId) ?? null
  const projectNames = id => projects.filter(p => p.members.some(m => m.user_id === id)).map(p => p.name).join(', ')
  const ids = new Set(people.map(p => p.id))
  const t = tasks.filter(x => ids.has(x.user_id) && (!project || x.project_id === project.id))
  const l = logs.filter(x => ids.has(x.user_id))
  const ctx = { tasks: t, logs: l, people, holidays, today }

  const current = summarize({ ...ctx, range })
  const previous = summarize({ ...ctx, range: prev })
  const persons = perPerson({ ...ctx, range }).sort((a, b) => a.name.localeCompare(b.name))
  const categories = categoryMix(inRange(t, range))
  const against = kind === 'weekly' ? 'the week before' : 'the month before'

  const scopeName =
    scope.kind === 'me' || scope.kind === 'person' ? (people[0]?.name ?? 'Unknown')
    : scope.kind === 'project' ? (project?.name ?? 'Project')
    : 'All employees'

  const details = persons.map(row => {
    const person = people.find(p => p.id === row.id)
    const pt = t.filter(x => x.user_id === row.id)
    const pl = l.filter(x => x.user_id === row.id)
    return {
      ...row,
      projects: projectNames(person.id),
      days: kind === 'weekly' ? dayRows(person, inRange(pt, range), inRange(pl, range), range, holidays, holidayNames, nameById, today) : null,
      weeks: kind === 'monthly' ? weekRows(person, pt, pl, range, holidays, today) : null,
      open: kind === 'monthly'
        ? inRange(pt, range).filter(x => x.status !== 'done').map(x => ({ title: x.title, status: x.status, date: x.date }))
        : null,
    }
  })

  return {
    org,
    kind,
    against,
    scope: { ...scope, name: scopeName },
    range,
    prev,
    generatedAt: new Date(),
    generatedBy,
    current,
    previous,
    growth: compare(current, previous),
    trend: trend({ ...ctx, range }),
    categories,
    persons,
    details,
    observations: observations({ current, previous, persons, categories, against }),
    holidaysInRange: holidayRows.filter(h => h.date >= range.from && h.date <= range.to),
  }
}

// scope: { kind: 'me'|'person'|'project'|'all', userId?, projectId? }
export async function buildReportData({ kind, range, scope, generatedBy }) {
  const prev = previousRange(range)
  const trendFrom = addDaysISO(weekStartISO(range.to), -7 * 7)
  const fetchFrom = [range.from, prev.from, trendFrom].sort()[0]

  // Logs belong to people, tasks to projects: only tasks are filtered by
  // project here; logs are narrowed to the project's members below.
  const scopeQ = (q, { byProject = false } = {}) => {
    q = q.gte('date', fetchFrom).lte('date', range.to)
    if (scope.userId) q = q.eq('user_id', scope.userId)
    if (byProject && scope.projectId) q = q.eq('project_id', scope.projectId)
    return q
  }

  const [org, holidaysRes, peopleRes, projectsRes, tasks, logs] = await Promise.all([
    supabase.from('org_settings').select('*').eq('id', 1).single(),
    supabase.from('holidays').select('date, name'),
    supabase.from('profiles').select('id, name, role, created_at, avatar_initials, is_active').eq('is_approved', true).order('name'),
    supabase.from('projects').select('id, name, members:project_members(user_id, role)').order('name'),
    all(() => scopeQ(supabase.from('v_task_facts').select('*'), { byProject: true })),
    all(() => scopeQ(supabase.from('v_log_facts').select('*'))),
  ])
  for (const r of [org, holidaysRes, peopleRes, projectsRes]) if (r.error) throw r.error

  const allProfiles = peopleRes.data ?? []
  let people = allProfiles.filter(p => p.is_active !== false)
  if (scope.userId) people = people.filter(p => p.id === scope.userId)
  // Team reports cover employees and BAs; logging is optional for managers, HR and admins.
  if (!scope.userId) people = people.filter(isTracked)
  const projects = projectsRes.data ?? []
  if (scope.projectId) {
    const members = new Set(projects.find(p => p.id === scope.projectId)?.members.map(m => m.user_id) ?? [])
    people = people.filter(p => members.has(p.id))
  }

  return shapeReport({
    kind, range, scope, org: org.data, people, allProfiles, projects,
    holidayRows: holidaysRes.data ?? [], tasks, logs, generatedBy,
  })
}

export function reportFileName(data) {
  const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
  const kind = data.kind === 'weekly' ? 'Weekly' : 'Monthly'
  return `${slug(data.org.company_name || 'StrideLog')}_${kind}_Report_${slug(data.scope.name)}_${data.range.from}_to_${data.range.to}.pdf`
}
