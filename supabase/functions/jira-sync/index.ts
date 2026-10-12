// Jira Cloud issues → StrideLog tasks.
//
// Each person is matched to Jira by their company email. Issues assigned to
// them become tasks whose status follows Jira (To do, In progress / In review,
// Blocked, Done), so the day list and reports show real progress.
//
// Setup (once, by a Jira admin): create an API token at
// https://id.atlassian.com/manage-profile/security/api-tokens, then:
//   supabase secrets set JIRA_SITE=https://<company>.atlassian.net JIRA_EMAIL=<admin email> JIRA_API_TOKEN=<token>
// For instant updates add a Jira webhook (Settings, System, WebHooks) pointing to
//   <functions url>/jira-sync?secret=<EMAIL_WEBHOOK_SECRET>
// for "Issue created / updated / deleted".
// Local testing without Jira: set JIRA_SYNC_MOCK=true.
//
// Requests (POST JSON):
//   { action: 'status' }       → is it configured?
//   { scope: 'me' }            → sync the caller
//   { scope: 'all' }           → sync everyone (HR / admin, or the scheduler)
//   { action: 'disconnect', remove: bool } → stop syncing the caller, optionally removing open Jira tasks
//   Jira webhook payload       → sync the people on that issue
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { planJira, mockIssues, type JiraIssue } from '../_shared/jira.ts'
import { localDate } from '../_shared/meetings.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''
const MOCK = env('JIRA_SYNC_MOCK') === 'true'
const SITE = (env('JIRA_SITE') || (MOCK ? 'https://example.atlassian.net' : '')).replace(/\/$/, '')
const configured = () => MOCK || Boolean(SITE && env('JIRA_EMAIL') && env('JIRA_API_TOKEN'))
const FIELDS = ['summary', 'status', 'duedate', 'resolutiondate', 'project', 'issuetype']

async function jira(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SITE}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${env('JIRA_EMAIL')}:${env('JIRA_API_TOKEN')}`)}`,
      Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// Jira account for a company email (needs the token owner to be able to see emails, true for admins).
async function accountFor(email: string): Promise<string | null> {
  const users = await jira(`/rest/api/3/user/search?query=${encodeURIComponent(email)}`)
  const match = (users as Array<{ accountId: string; emailAddress?: string; accountType?: string }>)
    .find(u => u.accountType === 'atlassian' && (!u.emailAddress || u.emailAddress.toLowerCase() === email.toLowerCase()))
  return match?.accountId ?? null
}

// Open issues plus anything finished in the last 14 days.
async function issuesFor(accountId: string): Promise<JiraIssue[]> {
  const jql = `assignee = "${accountId}" AND (statusCategory != Done OR resolutiondate >= -14d) ORDER BY updated DESC`
  const out: JiraIssue[] = []
  let nextPageToken: string | undefined
  do {
    const body = await jira('/rest/api/3/search/jql', {
      method: 'POST', body: JSON.stringify({ jql, fields: FIELDS, maxResults: 100, nextPageToken }),
    })
    out.push(...body.issues)
    nextPageToken = body.isLast ? undefined : body.nextPageToken
  } while (nextPageToken && out.length < 500)
  return out
}

type Person = { id: string; email: string; jira_account_id: string | null }
type Ctx = { today: string; tz: string; categoryIds: Map<string, string>; projectIds: Map<string, string> }

async function syncPerson(db: SupabaseClient, person: Person, ctx: Ctx) {
  let issues: JiraIssue[]
  if (MOCK) {
    issues = mockIssues(person.email, ctx.today)
  } else {
    let accountId = person.jira_account_id
    if (!accountId) {
      accountId = await accountFor(person.email)
      if (!accountId) return { created: 0, updated: 0, removed: 0, skipped: true }
      await db.from('profiles').update({ jira_account_id: accountId }).eq('id', person.id)
    }
    issues = await issuesFor(accountId)
  }

  const { data: existing, error } = await db.from('tasks')
    .select('id, external_id, title, date, status, description, due_date, project_id')
    .eq('user_id', person.id).eq('source', 'jira')
  if (error) throw error

  const plan = planJira(issues, existing ?? [], { today: ctx.today, tz: ctx.tz, site: SITE, projectIds: ctx.projectIds })
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
  const secret = env('EMAIL_WEBHOOK_SECRET')
  const urlSecret = new URL(req.url).searchParams.get('secret')

  // Who is asking? The scheduler (header secret), Jira (secret in the URL) or a person.
  const fromScheduler = Boolean(secret) && req.headers.get('x-webhook-secret') === secret
  const fromJira = Boolean(secret) && urlSecret === secret && Boolean(body.webhookEvent)
  let caller: { id: string; role: string } | null = null
  if (!fromScheduler && !fromJira) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return json({ error: 'Not signed in' }, 401)
    const { data } = await db.from('profiles').select('id, role, is_approved, is_active').eq('id', user.id).single()
    if (!data?.is_approved || !data.is_active) return json({ error: 'Account not active' }, 403)
    caller = data
  }

  const { data: org } = await db.from('org_settings').select('timezone, jira_sync_enabled').eq('id', 1).single()
  if (body.action === 'status') {
    return json({ configured: configured(), enabled: Boolean(org?.jira_sync_enabled), mock: MOCK, site: SITE || null })
  }

  // Stop syncing for the caller; optionally clear their unfinished Jira tasks (finished ones stay as history).
  if (body.action === 'disconnect' && caller) {
    await db.from('profiles').update({ jira_sync: false }).eq('id', caller.id)
    let removed = 0
    if (body.remove) {
      const { data } = await db.from('tasks').delete().eq('user_id', caller.id).eq('source', 'jira').neq('status', 'done').select('id')
      removed = data?.length ?? 0
    }
    return json({ ok: true, removed })
  }

  if (!configured()) return json({ error: 'Jira is not connected yet. Ask an admin to finish the Jira setup.' }, 400)
  if (!org?.jira_sync_enabled) return json(fromJira ? { ok: true, ignored: true } : { error: 'Jira sync is turned off for the company.' }, fromJira ? 200 : 400)

  const scope = body.scope === 'all' ? 'all' : 'me'
  if (!fromScheduler && !fromJira && scope === 'all' && !['hr', 'admin'].includes(caller!.role)) {
    return json({ error: 'Only HR or an admin can sync everyone' }, 403)
  }

  let q = db.from('profiles').select('id, email, jira_account_id')
    .eq('is_approved', true).eq('is_active', true).eq('jira_sync', true).not('email', 'is', null)
  if (fromJira) {
    // The current assignee and, when reassigned, the previous one.
    const ids = new Set<string>()
    const assignee = body.issue?.fields?.assignee?.accountId
    if (assignee) ids.add(assignee)
    for (const item of body.changelog?.items ?? []) {
      if (item.field === 'assignee' && item.from) ids.add(item.from)
    }
    if (!ids.size) return json({ ok: true, people: 0 })
    q = q.in('jira_account_id', [...ids])
  } else if (scope === 'me') {
    q = q.eq('id', caller!.id)
  }
  const { data: people, error: pErr } = await q
  if (pErr) return json({ error: pErr.message }, 500)
  if (fromJira && !people?.length) return json({ ok: true, people: 0 })

  const { data: run } = await db.from('sync_runs').insert({
    source: 'jira',
    trigger: fromJira ? 'webhook' : fromScheduler ? 'schedule' : scope === 'all' ? 'admin' : 'person',
    triggered_by: caller?.id ?? null,
  }).select('id').single()

  const tz = org.timezone || 'Asia/Kolkata'
  const totals = { people: 0, created: 0, updated: 0, removed: 0, notFound: 0 }
  let error: string | null = null
  try {
    const [{ data: cats }, { data: projects }] = await Promise.all([
      db.from('categories').select('id, name'),
      db.from('projects').select('id, name').eq('is_active', true),
    ])
    const ctx: Ctx = {
      today: localDate(new Date(), tz), tz,
      categoryIds: new Map((cats ?? []).map(c => [c.name, c.id])),
      projectIds: new Map((projects ?? []).map(p => [p.name.toLowerCase(), p.id])),
    }
    const list = (people ?? []) as Person[]
    for (let i = 0; i < list.length; i += 4) {
      const results = await Promise.all(list.slice(i, i + 4).map(p => syncPerson(db, p, ctx)))
      for (const r of results) {
        if (r.skipped) { totals.notFound++; continue }
        totals.people++; totals.created += r.created; totals.updated += r.updated; totals.removed += r.removed
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (run) {
    await db.from('sync_runs').update({
      finished_at: new Date().toISOString(), people: totals.people, created: totals.created,
      updated: totals.updated, removed: totals.removed, error,
    }).eq('id', run.id)
  }
  return error ? json({ error, ...totals }, 502) : json({ ok: true, mock: MOCK, ...totals })
})
