// Jira Cloud issues → StrideLog tasks. Two modes:
//   * Company: an admin's connection (org_settings.jira_company_user) reads
//     every issue of the linked Jira projects. Each issue becomes a task of
//     its assignee; unassigned issues, and issues of people not in StrideLog,
//     go to jira_issues for the board.
//   * Personal: everyone who connected their own Atlassian account (Account,
//     Connected apps) gets the issues assigned to them.
// Tasks follow the Jira status (To do, In progress, In review, Blocked, Done).
// Runs every 15 minutes on working days and when people open their day.
//
// Requests (POST JSON):
//   { scope: 'me' }   → sync the caller (company mode: the whole company, at most every 2 minutes)
//   { scope: 'all' }  → sync everyone (HR / admin, or the scheduler)
// Auth: a user JWT, or the x-webhook-secret header used by the scheduler.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  planJira, mockIssues, assignIssues, unownedRows, mockCompanyIssues, type JiraIssue, type Person as JiraPerson,
} from '../_shared/jira.ts'
import { localDate } from '../_shared/meetings.ts'
import { accessToken, isConfigured, isMock, type Connection } from '../_shared/oauth.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''
const MOCK = isMock('jira')
const FIELDS = ['summary', 'status', 'duedate', 'resolutiondate', 'project', 'issuetype', 'updated']

async function search(token: string, cloudId: string, jql: string, fields: string[], max: number): Promise<JiraIssue[]> {
  const out: JiraIssue[] = []
  let nextPageToken: string | undefined
  do {
    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, fields, maxResults: 100, nextPageToken }),
    })
    if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    out.push(...body.issues)
    nextPageToken = body.isLast ? undefined : body.nextPageToken
  } while (nextPageToken && out.length < max)
  return out
}

// Open issues assigned to the person plus anything they finished in the last 14 days.
const myIssues = (token: string, cloudId: string) =>
  search(token, cloudId, 'assignee = currentUser() AND (statusCategory != Done OR resolutiondate >= -14d) ORDER BY updated DESC', FIELDS, 500)

// Every open issue of the company's Jira projects plus what was finished in the last 60 days.
const companyIssues = (token: string, cloudId: string, keys: string[]) =>
  search(token, cloudId,
    `project in (${keys.map(k => `"${k}"`).join(', ')}) AND (statusCategory != Done OR resolutiondate >= -60d) ORDER BY updated DESC`,
    [...FIELDS, 'assignee'], 3000)

type Person = { id: string; email: string; connection: Connection }
type Ctx = { today: string; tz: string; categoryIds: Map<string, string>; projectIds: Map<string, string> }
type Totals = { people: number; created: number; updated: number; removed: number; notFound: number }

// Make one person's Jira tasks match their issues. keys: only touch tasks of
// these Jira projects (company mode), so other mirrored issues are left alone.
async function mirror(db: SupabaseClient, personId: string, issues: JiraIssue[], site: string, ctx: Ctx, keys?: string[]) {
  const { data: rows, error } = await db.from('tasks')
    .select('id, external_id, title, date, status, description, due_date, project_id, external_updated_at')
    .eq('user_id', personId).eq('source', 'jira')
  if (error) throw error
  const existing = keys ? (rows ?? []).filter(t => keys.some(k => t.external_id?.startsWith(`${k}-`))) : rows ?? []

  const plan = planJira(issues, existing, { today: ctx.today, tz: ctx.tz, site, projectIds: ctx.projectIds })
  if (plan.inserts.length) {
    const rows = plan.inserts.map(({ categoryName, ...t }) => ({
      ...t, user_id: personId, source: 'jira',
      category_id: ctx.categoryIds.get(String(categoryName)) ?? ctx.categoryIds.get('Development') ?? null,
    }))
    const ins = await db.from('tasks').insert(rows)
    if (ins.error) throw ins.error
  }
  for (const u of plan.updates) {
    const up = await db.from('tasks').update(u.fields).eq('id', u.id)
    if (up.error) throw up.error
  }
  if (plan.deletes.length) {
    const del = await db.from('tasks').delete().in('id', plan.deletes)
    if (del.error) throw del.error
  }
  await db.from('profiles').update({ jira_synced_at: new Date().toISOString() }).eq('id', personId)
  return { created: plan.inserts.length, updated: plan.updates.length, removed: plan.deletes.length }
}

async function syncPerson(db: SupabaseClient, person: Person, ctx: Ctx) {
  const token = await accessToken(db, person.connection)
  if (!token) return { created: 0, updated: 0, removed: 0, skipped: true }   // access was revoked
  const site = person.connection.site_url ?? 'https://example.atlassian.net'
  const issues = MOCK ? mockIssues(person.email, ctx.today) : await myIssues(token, person.connection.cloud_id!)
  return { ...await mirror(db, person.id, issues, site, ctx), skipped: false }
}

// Company mode: one connection reads the linked projects for everyone.
async function syncCompany(db: SupabaseClient, conn: Connection, keys: string[], ctx: Ctx, totals: Totals, errors: string[]) {
  const token = await accessToken(db, conn)
  if (!token) throw new Error('The company Jira connection was removed. Connect again under Admin, Integrations.')
  const site = conn.site_url ?? 'https://example.atlassian.net'

  const { data: people, error } = await db.from('profiles')
    .select('id, email, name, role, jira_account_id').eq('is_approved', true).eq('is_active', true)
  if (error) throw error
  const issues = MOCK
    ? mockCompanyIssues((people ?? []).filter(p => ['employee', 'ba'].includes(p.role)), ctx.today, keys)
    : await companyIssues(token, conn.cloud_id!, keys)
  const { owned, unowned, newLinks } = assignIssues(issues, (people ?? []) as JiraPerson[])

  // Remember matched Jira accounts; best effort, a clash just leaves it unset.
  for (const [id, accountId] of newLinks) await db.from('profiles').update({ jira_account_id: accountId }).eq('id', id)

  const owners = [...owned.entries()]
  for (let i = 0; i < owners.length; i += 4) {
    const batch = owners.slice(i, i + 4)
    const results = await Promise.allSettled(batch.map(([id, list]) => mirror(db, id, list, site, ctx, keys)))
    results.forEach((r, j) => {
      if (r.status === 'rejected') { errors.push(`${batch[j][0]}: ${(r.reason as Error).message}`); return }
      if (batch[j][1].length) totals.people++
      totals.created += r.value.created; totals.updated += r.value.updated; totals.removed += r.value.removed
    })
  }

  // Unowned issues: open ones, plus anything finished in the last 14 days.
  const recent = Date.parse(`${ctx.today}T00:00:00Z`) - 14 * 86_400_000
  const keep = unowned.filter(x => x.fields.status.statusCategory.key !== 'done' || Date.parse(x.fields.resolutiondate ?? '') >= recent)
  const del = await db.from('jira_issues').delete().neq('key', '')
  if (del.error) throw del.error
  if (keep.length) {
    const ins = await db.from('jira_issues').insert(unownedRows(keep, { site, projectIds: ctx.projectIds }))
    if (ins.error) throw ins.error
  }
  return keep.length
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const body = await req.json().catch(() => ({}))

  let caller: { id: string; role: string } | null = null
  const fromScheduler = Boolean(env('EMAIL_WEBHOOK_SECRET')) && req.headers.get('x-webhook-secret') === env('EMAIL_WEBHOOK_SECRET')
  if (!fromScheduler) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return json({ error: 'Not signed in' }, 401)
    const { data } = await db.from('profiles').select('id, role, is_approved, is_active').eq('id', user.id).single()
    if (!data?.is_approved || !data.is_active) return json({ error: 'Account not active' }, 403)
    caller = data
  }

  const { data: org } = await db.from('org_settings').select('timezone, jira_sync_enabled, jira_company_user').eq('id', 1).single()
  if (!isConfigured('jira')) return json({ error: 'Jira is not set up yet. Ask an admin.' }, 400)
  if (!org?.jira_sync_enabled) return json({ error: 'Jira sync is turned off for the company.' }, 400)

  const scope = body.scope === 'all' ? 'all' : 'me'
  if (scope === 'all' && caller && !['hr', 'admin'].includes(caller.role)) {
    return json({ error: 'Only HR or an admin can sync everyone' }, 403)
  }

  const tz = org.timezone || 'Asia/Kolkata'
  const [{ data: cats }, { data: projects }, { data: links }] = await Promise.all([
    db.from('categories').select('id, name'),
    db.from('projects').select('id, name').eq('is_active', true),
    db.from('jira_project_links').select('jira_key, jira_name, project_id'),
  ])
  const ctx: Ctx = {
    today: localDate(new Date(), tz), tz,
    categoryIds: new Map((cats ?? []).map(c => [c.name, c.id])),
    projectIds: new Map((projects ?? []).map(p => [p.name.toLowerCase(), p.id])),
  }
  // Projects the admin linked win over name matches.
  for (const l of links ?? []) {
    if (!l.project_id) continue
    ctx.projectIds.set(l.jira_name.toLowerCase(), l.project_id)
    ctx.projectIds.set(l.jira_key.toLowerCase(), l.project_id)
  }

  const company = Boolean(org.jira_company_user)
  let companyConn: Connection | null = null
  const keys = (links ?? []).map(l => l.jira_key)
  if (company) {
    if (!keys.length) return json({ error: 'Pick the Jira projects to read under Admin, Integrations.' }, 400)
    const { data } = await db.from('oauth_connections').select('*').eq('user_id', org.jira_company_user).eq('provider', 'jira').maybeSingle()
    if (!data) return json({ error: 'The company Jira connection is missing. Connect again under Admin, Integrations.' }, 400)
    companyConn = data as Connection
    // Opening My Day asks too; one company run every 2 minutes is plenty.
    if (scope === 'me') {
      const { data: last } = await db.from('sync_runs').select('started_at').eq('source', 'jira')
        .order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (last && Date.now() - Date.parse(last.started_at) < 2 * 60_000) {
        return json({ ok: true, mock: MOCK, company, people: 0, created: 0, updated: 0, removed: 0 })
      }
    }
  }

  let people: Person[] = []
  if (!company) {
    let q = db.from('oauth_connections').select('*, profile:profiles!inner(id, email, is_approved, is_active, jira_sync)')
      .eq('provider', 'jira').eq('profile.is_approved', true).eq('profile.is_active', true).eq('profile.jira_sync', true)
    if (scope === 'me') q = q.eq('user_id', caller!.id)
    const { data: rows, error: pErr } = await q
    if (pErr) return json({ error: pErr.message }, 500)
    if (scope === 'me' && !rows?.length) return json({ error: 'Connect your Jira account first (Account, Connected apps).' }, 400)
    people = (rows ?? []).map(({ profile, ...c }) => ({ id: profile.id, email: profile.email, connection: c as Connection }))
  }

  const { data: run } = await db.from('sync_runs').insert({
    source: 'jira',
    trigger: fromScheduler ? 'schedule' : scope === 'all' ? 'admin' : 'person',
    triggered_by: caller?.id ?? null,
  }).select('id').single()

  const totals: Totals = { people: 0, created: 0, updated: 0, removed: 0, notFound: 0 }
  const errors: string[] = []
  let unowned = 0

  try {
    if (companyConn) {
      unowned = await syncCompany(db, companyConn, keys, ctx, totals, errors)
    } else {
      for (let i = 0; i < people.length; i += 4) {
        const results = await Promise.allSettled(people.slice(i, i + 4).map(p => syncPerson(db, p, ctx)))
        results.forEach((r, j) => {
          if (r.status === 'rejected') { errors.push(`${people[i + j].email}: ${(r.reason as Error).message}`); return }
          if (r.value.skipped) { totals.notFound++; return }
          totals.people++; totals.created += r.value.created; totals.updated += r.value.updated; totals.removed += r.value.removed
        })
      }
    }
  } catch (e) {
    errors.unshift((e as Error).message)
    if (companyConn) totals.people = 0
  }

  const error = errors.length ? errors.slice(0, 3).join('; ').slice(0, 500) : null
  if (run) {
    await db.from('sync_runs').update({
      finished_at: new Date().toISOString(), people: totals.people, created: totals.created,
      updated: totals.updated, removed: totals.removed, error,
    }).eq('id', run.id)
  }
  if ((scope === 'me' || company) && error && !totals.people) return json({ error, ...totals }, 502)
  return json({ ok: true, mock: MOCK, company, unowned, ...totals, ...(error && { warning: error }) })
})
