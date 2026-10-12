// Microsoft Teams / Outlook calendar → StrideLog tasks.
//
// Setup (once, by an admin): register an app in Microsoft Entra ID with the
// Microsoft Graph *application* permission Calendars.Read, grant admin consent,
// create a client secret, then:
//   supabase secrets set MS_TENANT_ID=... MS_CLIENT_ID=... MS_CLIENT_SECRET=...
// Local testing without Microsoft 365: set TEAMS_SYNC_MOCK=true.
//
// Requests (POST JSON):
//   { action: 'status' }                    → is it configured?
//   { scope: 'me' }                         → sync the caller (any signed in person)
//   { scope: 'all' }                        → sync everyone (HR / admin, or the scheduler)
// Auth: a user JWT, or the x-webhook-secret header used by the scheduler.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { meetingsFrom, planSync, mockEvents, localDate, type GraphEvent } from '../_shared/meetings.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''
const MOCK = env('TEAMS_SYNC_MOCK') === 'true'
const configured = () => MOCK || Boolean(env('MS_TENANT_ID') && env('MS_CLIENT_ID') && env('MS_CLIENT_SECRET'))

async function graphToken() {
  const res = await fetch(`https://login.microsoftonline.com/${env('MS_TENANT_ID')}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('MS_CLIENT_ID'),
      client_secret: env('MS_CLIENT_SECRET'),
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Microsoft sign in failed: ${body.error_description ?? body.error ?? res.status}`)
  return body.access_token as string
}

// All calendar entries for one mailbox in [from, to) (UTC), following pages.
async function calendarView(token: string, email: string, from: string, to: string): Promise<GraphEvent[] | null> {
  const select = 'id,subject,start,end,isAllDay,isCancelled,isOnlineMeeting,onlineMeetingProvider,showAs,sensitivity,responseStatus'
  let url: string | null = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/calendarView` +
    `?startDateTime=${from}&endDateTime=${to}&$select=${select}&$top=100`
  const out: GraphEvent[] = []
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } })
    if (res.status === 404) return null      // no mailbox for this email in the tenant
    if (!res.ok) throw new Error(`Calendar read failed for ${email}: ${res.status} ${await res.text()}`)
    const body = await res.json()
    out.push(...body.value)
    url = body['@odata.nextLink'] ?? null
  }
  return out
}

async function syncPerson(db: SupabaseClient, person: { id: string; email: string }, ctx: {
  token: string | null; tz: string; dates: string[]; onlyOnline: boolean; categoryIds: Map<string, string>; from: string; to: string
}) {
  const events = MOCK ? mockEvents(person.email, ctx.dates) : await calendarView(ctx.token!, person.email, ctx.from, ctx.to)
  if (events === null) return { created: 0, updated: 0, removed: 0, skipped: true }

  const meetings = meetingsFrom(events, { tz: ctx.tz, dates: ctx.dates, onlyOnline: ctx.onlyOnline })
  const { data: existing, error } = await db.from('tasks')
    .select('id, external_id, title, date, status, description')
    .eq('user_id', person.id).eq('source', 'teams').in('date', ctx.dates)
  if (error) throw error

  const plan = planSync(meetings, existing ?? [], new Date())
  if (plan.inserts.length) {
    const rows = plan.inserts.map(({ categoryName, ...t }) => ({
      ...t, user_id: person.id, source: 'teams', category_id: ctx.categoryIds.get(String(categoryName)) ?? null,
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
  await db.from('profiles').update({ calendar_synced_at: new Date().toISOString() }).eq('id', person.id)
  return { created: plan.inserts.length, updated: plan.updates.length, removed: plan.deletes.length, skipped: false }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const body = await req.json().catch(() => ({}))

  // Who is asking?
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

  const { data: org } = await db.from('org_settings').select('timezone, teams_sync_enabled, teams_only_online').eq('id', 1).single()
  if (body.action === 'status') {
    return json({ configured: configured(), enabled: Boolean(org?.teams_sync_enabled), mock: MOCK })
  }
  if (!configured()) return json({ error: 'Microsoft 365 is not connected yet. Ask an admin to finish the Teams setup.' }, 400)
  if (!org?.teams_sync_enabled) return json({ error: 'Teams sync is turned off for the company.' }, 400)

  const scope = body.scope === 'all' ? 'all' : 'me'
  if (scope === 'all' && caller && !['hr', 'admin'].includes(caller.role)) {
    return json({ error: 'Only HR or an admin can sync everyone' }, 403)
  }

  // Window: yesterday and today in the company timezone (with a day of
  // margin on each side for timezone offsets, then filtered by local date).
  const tz = org.timezone || 'Asia/Kolkata'
  const now = new Date()
  const today = localDate(now, tz)
  const yesterday = localDate(new Date(now.getTime() - 86400000), tz)
  const dates = [yesterday, today]
  const from = new Date(Date.parse(`${yesterday}T00:00:00Z`) - 86400000).toISOString()
  const to = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86400000).toISOString()

  let q = db.from('profiles').select('id, email').eq('is_approved', true).eq('is_active', true).eq('calendar_sync', true).not('email', 'is', null)
  if (scope === 'me') q = q.eq('id', caller!.id)
  const { data: people, error: pErr } = await q
  if (pErr) return json({ error: pErr.message }, 500)

  const { data: run } = await db.from('sync_runs').insert({
    trigger: fromScheduler ? 'schedule' : scope === 'all' ? 'admin' : 'person',
    triggered_by: caller?.id ?? null,
  }).select('id').single()

  const totals = { people: 0, created: 0, updated: 0, removed: 0, notFound: 0 }
  let error: string | null = null
  try {
    const { data: cats } = await db.from('categories').select('id, name')
    const ctx = {
      token: MOCK ? null : await graphToken(), tz, dates, from, to,
      onlyOnline: org.teams_only_online, categoryIds: new Map((cats ?? []).map(c => [c.name, c.id])),
    }
    // A few mailboxes at a time keeps Microsoft's rate limits happy.
    const list = people ?? []
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
