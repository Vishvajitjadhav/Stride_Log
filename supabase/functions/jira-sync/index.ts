// Jira Cloud issues → StrideLog tasks, for everyone who connected their own
// Atlassian account (Account, Connected apps). Issues assigned to them become
// tasks whose status follows Jira (To do, In progress / In review, Blocked,
// Done). Runs every 15 minutes on working days and when they open their day.
//
// Requests (POST JSON):
//   { scope: 'me' }   → sync the caller
//   { scope: 'all' }  → sync everyone connected (HR / admin, or the scheduler)
// Auth: a user JWT, or the x-webhook-secret header used by the scheduler.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { planJira, mockIssues, type JiraIssue } from '../_shared/jira.ts'
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
const FIELDS = ['summary', 'status', 'duedate', 'resolutiondate', 'project', 'issuetype']

// Open issues assigned to the person plus anything they finished in the last 14 days.
async function myIssues(token: string, cloudId: string): Promise<JiraIssue[]> {
  const jql = 'assignee = currentUser() AND (statusCategory != Done OR resolutiondate >= -14d) ORDER BY updated DESC'
  const out: JiraIssue[] = []
  let nextPageToken: string | undefined
  do {
    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, fields: FIELDS, maxResults: 100, nextPageToken }),
    })
    if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    out.push(...body.issues)
    nextPageToken = body.isLast ? undefined : body.nextPageToken
  } while (nextPageToken && out.length < 500)
  return out
}

type Person = { id: string; email: string; connection: Connection }
type Ctx = { today: string; tz: string; categoryIds: Map<string, string>; projectIds: Map<string, string> }

async function syncPerson(db: SupabaseClient, person: Person, ctx: Ctx) {
  const token = await accessToken(db, person.connection)
  if (!token) return { created: 0, updated: 0, removed: 0, skipped: true }   // access was revoked
  const site = person.connection.site_url ?? 'https://example.atlassian.net'
  const issues = MOCK ? mockIssues(person.email, ctx.today) : await myIssues(token, person.connection.cloud_id!)

  const { data: existing, error } = await db.from('tasks')
    .select('id, external_id, title, date, status, description, due_date, project_id')
    .eq('user_id', person.id).eq('source', 'jira')
  if (error) throw error

  const plan = planJira(issues, existing ?? [], { today: ctx.today, tz: ctx.tz, site, projectIds: ctx.projectIds })
  if (plan.inserts.length) {
    const rows = plan.inserts.map(({ categoryName, ...t }) => ({
      ...t, user_id: person.id, source: 'jira',
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
  await db.from('profiles').update({ jira_synced_at: new Date().toISOString() }).eq('id', person.id)
  return { created: plan.inserts.length, updated: plan.updates.length, removed: plan.deletes.length, skipped: false }
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

  const { data: org } = await db.from('org_settings').select('timezone, jira_sync_enabled').eq('id', 1).single()
  if (!isConfigured('jira')) return json({ error: 'Jira is not set up yet. Ask an admin.' }, 400)
  if (!org?.jira_sync_enabled) return json({ error: 'Jira sync is turned off for the company.' }, 400)

  const scope = body.scope === 'all' ? 'all' : 'me'
  if (scope === 'all' && caller && !['hr', 'admin'].includes(caller.role)) {
    return json({ error: 'Only HR or an admin can sync everyone' }, 403)
  }

  let q = db.from('oauth_connections').select('*, profile:profiles!inner(id, email, is_approved, is_active, jira_sync)')
    .eq('provider', 'jira').eq('profile.is_approved', true).eq('profile.is_active', true).eq('profile.jira_sync', true)
  if (scope === 'me') q = q.eq('user_id', caller!.id)
  const { data: rows, error: pErr } = await q
  if (pErr) return json({ error: pErr.message }, 500)
  if (scope === 'me' && !rows?.length) return json({ error: 'Connect your Jira account first (Account, Connected apps).' }, 400)

  const { data: run } = await db.from('sync_runs').insert({
    source: 'jira',
    trigger: fromScheduler ? 'schedule' : scope === 'all' ? 'admin' : 'person',
    triggered_by: caller?.id ?? null,
  }).select('id').single()

  const tz = org.timezone || 'Asia/Kolkata'
  const totals = { people: 0, created: 0, updated: 0, removed: 0, notFound: 0 }
  const errors: string[] = []
  const [{ data: cats }, { data: projects }] = await Promise.all([
    db.from('categories').select('id, name'),
    db.from('projects').select('id, name').eq('is_active', true),
  ])
  const ctx: Ctx = {
    today: localDate(new Date(), tz), tz,
    categoryIds: new Map((cats ?? []).map(c => [c.name, c.id])),
    projectIds: new Map((projects ?? []).map(p => [p.name.toLowerCase(), p.id])),
  }
  const people: Person[] = (rows ?? []).map(({ profile, ...c }) => ({ id: profile.id, email: profile.email, connection: c as Connection }))

  for (let i = 0; i < people.length; i += 4) {
    const results = await Promise.allSettled(people.slice(i, i + 4).map(p => syncPerson(db, p, ctx)))
    results.forEach((r, j) => {
      if (r.status === 'rejected') { errors.push(`${people[i + j].email}: ${(r.reason as Error).message}`); return }
      if (r.value.skipped) { totals.notFound++; return }
      totals.people++; totals.created += r.value.created; totals.updated += r.value.updated; totals.removed += r.value.removed
    })
  }

  const error = errors.length ? errors.slice(0, 3).join('; ').slice(0, 500) : null
  if (run) {
    await db.from('sync_runs').update({
      finished_at: new Date().toISOString(), people: totals.people, created: totals.created,
      updated: totals.updated, removed: totals.removed, error,
    }).eq('id', run.id)
  }
  if (scope === 'me' && error) return json({ error, ...totals }, 502)
  return json({ ok: true, mock: MOCK, ...totals, ...(error && { warning: error }) })
})
