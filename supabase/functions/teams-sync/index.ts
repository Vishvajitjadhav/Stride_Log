// Microsoft Teams / Outlook calendar → StrideLog tasks, for everyone who
// connected their own Microsoft account (Account, Connected apps).
//
// Requests (POST JSON):
//   { scope: 'me' }   → sync the caller
//   { scope: 'all' }  → sync everyone connected (HR / admin, or the scheduler)
// Auth: a user JWT, or the x-webhook-secret header used by the scheduler.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { meetingsFrom, planSync, mockEvents, localDate, type GraphEvent } from '../_shared/meetings.ts'
import { accessToken, isConfigured, isMock, type Connection } from '../_shared/oauth.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''
const MOCK = isMock('teams')

// The person's own calendar entries in [from, to) (UTC), following pages.
async function calendarView(token: string, from: string, to: string): Promise<GraphEvent[]> {
  const select = 'id,subject,start,end,isAllDay,isCancelled,isOnlineMeeting,onlineMeetingProvider,showAs,sensitivity,responseStatus'
  let url: string | null = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${from}&endDateTime=${to}&$select=${select}&$top=100`
  const out: GraphEvent[] = []
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } })
    if (!res.ok) throw new Error(`Calendar read failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    out.push(...body.value)
    url = body['@odata.nextLink'] ?? null
  }
  return out
}

type Person = { id: string; email: string; connection: Connection }
type Ctx = { tz: string; dates: string[]; onlyOnline: boolean; categoryIds: Map<string, string>; from: string; to: string }

async function syncPerson(db: SupabaseClient, person: Person, ctx: Ctx) {
  const token = await accessToken(db, person.connection)
  if (!token) return { created: 0, updated: 0, removed: 0, skipped: true }   // access was revoked
  const events = MOCK ? mockEvents(person.email, ctx.dates) : await calendarView(token, ctx.from, ctx.to)

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
  if (!isConfigured('teams')) return json({ error: 'Microsoft Teams is not set up yet. Ask an admin.' }, 400)
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

  // Connected people who have not paused it.
  let q = db.from('oauth_connections').select('*, profile:profiles!inner(id, email, is_approved, is_active, calendar_sync)')
    .eq('provider', 'teams').eq('profile.is_approved', true).eq('profile.is_active', true).eq('profile.calendar_sync', true)
  if (scope === 'me') q = q.eq('user_id', caller!.id)
  const { data: rows, error: pErr } = await q
  if (pErr) return json({ error: pErr.message }, 500)
  if (scope === 'me' && !rows?.length) return json({ error: 'Connect your Microsoft account first (Account, Connected apps).' }, 400)

  const { data: run } = await db.from('sync_runs').insert({
    source: 'teams',
    trigger: fromScheduler ? 'schedule' : scope === 'all' ? 'admin' : 'person',
    triggered_by: caller?.id ?? null,
  }).select('id').single()

  const totals = { people: 0, created: 0, updated: 0, removed: 0, notFound: 0 }
  const errors: string[] = []
  const { data: cats } = await db.from('categories').select('id, name')
  const ctx: Ctx = { tz, dates, from, to, onlyOnline: org.teams_only_online, categoryIds: new Map((cats ?? []).map(c => [c.name, c.id])) }
  const people: Person[] = (rows ?? []).map(({ profile, ...c }) => ({ id: profile.id, email: profile.email, connection: c as Connection }))

  // A few people at a time keeps Microsoft's rate limits happy; one
  // person's problem never stops the others.
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
