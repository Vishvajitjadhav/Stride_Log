// Connect your own Microsoft (Teams calendar) or Atlassian (Jira) account.
//
//   POST { action: 'status' }                         → per app: available, connected, account
//   POST { action: 'start', provider }                → { url } to send the browser to
//   GET  ?code=..&state=..   (the provider redirects here after sign in)
//   POST { action: 'disconnect', provider, remove }   → forget the account; optionally remove open synced tasks
//
// Register this function's URL as the redirect / callback URL in both app
// registrations: https://<project>.supabase.co/functions/v1/connect
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  PROVIDERS, isConfigured, isMock, authorizeUrl, exchangeCode, saveConnection, signState, readState, callbackUrl, type Provider,
} from '../_shared/oauth.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } })

const env = (k: string) => Deno.env.get(k) ?? ''
const PROVIDER_LIST: Provider[] = ['teams', 'jira']
const FLAG = { teams: 'calendar_sync', jira: 'jira_sync' } as const

// Who they signed in as, and for Jira which site.
async function identity(p: Provider, token: string) {
  if (p === 'teams') {
    const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',
      { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    return { account_email: (me.mail ?? me.userPrincipalName ?? '').toLowerCase() || null, account_name: me.displayName ?? null }
  }
  const [me, sites] = await Promise.all([
    fetch('https://api.atlassian.com/me', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }).then(r => r.json()),
    fetch('https://api.atlassian.com/oauth/token/accessible-resources', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }).then(r => r.json()),
  ])
  const site = (Array.isArray(sites) ? sites : []).find((s: { scopes?: string[] }) => s.scopes?.some(x => x.includes('jira'))) ?? sites?.[0]
  if (!site) throw new Error('This Atlassian account has no Jira site.')
  return { account_email: me.email?.toLowerCase() ?? null, account_name: me.name ?? null, cloud_id: site.id, site_url: site.url }
}

async function callback(db: SupabaseClient, url: URL) {
  const state = await readState(url.searchParams.get('state'))
  if (!state) return new Response('This sign in link has expired. Go back to StrideLog and press Connect again.', { status: 400 })
  const back = (q: string) => redirect(`${state.r}/profile?${q}`)

  const denied = url.searchParams.get('error')
  if (denied) return back(`connect_error=${encodeURIComponent(url.searchParams.get('error_description') ?? denied)}&app=${state.p}`)
  const code = url.searchParams.get('code')
  if (!code) return back(`connect_error=${encodeURIComponent('No sign in code was returned.')}&app=${state.p}`)

  try {
    if (isMock(state.p)) {
      const { data: person } = await db.from('profiles').select('email, name').eq('id', state.u).single()
      await saveConnection(db, {
        user_id: state.u, provider: state.p, account_email: person?.email ?? null, account_name: person?.name ?? null,
        ...(state.p === 'jira' && { cloud_id: 'mock', site_url: 'https://example.atlassian.net' }),
      }, { access_token: 'mock', refresh_token: 'mock', expires_in: 3600 })
    } else {
      const tokens = await exchangeCode(state.p, code)
      const who = await identity(state.p, tokens.access_token)
      await saveConnection(db, { user_id: state.u, provider: state.p, ...who }, tokens)
    }
    await db.from('profiles').update({ [FLAG[state.p]]: true }).eq('id', state.u)
    return back(`connected=${state.p}`)
  } catch (e) {
    return back(`connect_error=${encodeURIComponent((e as Error).message.slice(0, 200))}&app=${state.p}`)
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const url = new URL(req.url)

  // Mock sign in page for local testing: jump straight back with a code.
  if (req.method === 'GET' && url.searchParams.get('mock_authorize')) {
    return redirect(`${callbackUrl()}?code=mock&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`)
  }
  if (req.method === 'GET') return callback(db, url)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Everything else is for the signed in person.
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: { user } } = await db.auth.getUser(jwt)
  if (!user) return json({ error: 'Not signed in' }, 401)
  const { data: me } = await db.from('profiles').select('id, is_approved, is_active').eq('id', user.id).single()
  if (!me?.is_approved || !me.is_active) return json({ error: 'Account not active' }, 403)

  const body = await req.json().catch(() => ({}))
  const { data: org } = await db.from('org_settings').select('teams_sync_enabled, jira_sync_enabled').eq('id', 1).single()
  const enabled = { teams: Boolean(org?.teams_sync_enabled), jira: Boolean(org?.jira_sync_enabled) }

  if (body.action === 'status') {
    const { data: rows } = await db.from('oauth_connections')
      .select('provider, account_email, account_name, site_url, connected_at, last_error').eq('user_id', user.id)
    const out: Record<string, unknown> = {}
    for (const p of PROVIDER_LIST) {
      const c = rows?.find(r => r.provider === p)
      out[p] = { configured: isConfigured(p), enabled: enabled[p], mock: isMock(p), connected: Boolean(c), ...(c ?? {}) }
    }
    return json(out)
  }

  const provider = body.provider as Provider
  if (!PROVIDER_LIST.includes(provider)) return json({ error: 'Unknown app' }, 400)

  if (body.action === 'start') {
    if (!isConfigured(provider)) return json({ error: `${PROVIDERS[provider].name} is not set up yet. Ask your admin.` }, 400)
    if (!enabled[provider]) return json({ error: `${PROVIDERS[provider].name} is turned off for the company.` }, 400)
    // Return to the app the request came from (the browser sets Origin).
    const origin = req.headers.get('Origin') ?? ''
    if (!/^https?:\/\/[^/]+$/.test(origin)) return json({ error: 'Unknown app address' }, 400)
    const state = await signState({ u: user.id, p: provider, r: origin })
    const target = isMock(provider) ? `${callbackUrl()}?mock_authorize=1&state=${encodeURIComponent(state)}` : authorizeUrl(provider, state)
    return json({ url: target })
  }

  if (body.action === 'disconnect') {
    await db.from('oauth_connections').delete().eq('user_id', user.id).eq('provider', provider)
    await db.from('profiles').update({ [FLAG[provider]]: false }).eq('id', user.id)
    let removed = 0
    if (body.remove) {
      // Finished tasks stay as history; Teams only removes today and later.
      let q = db.from('tasks').delete().eq('user_id', user.id).eq('source', provider).neq('status', 'done')
      if (provider === 'teams') q = q.gte('date', new Date().toISOString().slice(0, 10))
      const { data } = await q.select('id')
      removed = data?.length ?? 0
    }
    return json({ ok: true, removed })
  }

  return json({ error: 'Unknown action' }, 400)
})
