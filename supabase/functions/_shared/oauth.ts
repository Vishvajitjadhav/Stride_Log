// "Connect your own account" for Microsoft (Teams / Outlook calendar) and
// Atlassian (Jira). One app registration per provider (see README); every
// person then signs in once and their tokens are kept in oauth_connections,
// which only the service role can read.
//
// Secrets:
//   MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID (optional, default "organizations")
//   ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET
//   CONNECT_CALLBACK_URL (optional; default <SUPABASE_URL>/functions/v1/connect)
// Local testing without either: TEAMS_SYNC_MOCK=true / JIRA_SYNC_MOCK=true.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type Provider = 'teams' | 'jira'

const env = (k: string) => Deno.env.get(k) ?? ''

export const isMock = (p: Provider) => env(p === 'teams' ? 'TEAMS_SYNC_MOCK' : 'JIRA_SYNC_MOCK') === 'true'

export const callbackUrl = () => env('CONNECT_CALLBACK_URL') || `${env('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/connect`

const msTenant = () => env('MS_TENANT_ID') || 'organizations'

export const PROVIDERS = {
  teams: {
    name: 'Microsoft Teams',
    clientId: () => env('MS_CLIENT_ID'),
    clientSecret: () => env('MS_CLIENT_SECRET'),
    authorizeUrl: () => `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`,
    scope: 'offline_access User.Read Calendars.Read',
    extraAuthorize: { response_mode: 'query', prompt: 'select_account' } as Record<string, string>,
    form: true,
  },
  jira: {
    name: 'Jira',
    clientId: () => env('ATLASSIAN_CLIENT_ID'),
    clientSecret: () => env('ATLASSIAN_CLIENT_SECRET'),
    authorizeUrl: () => 'https://auth.atlassian.com/authorize',
    tokenUrl: () => 'https://auth.atlassian.com/oauth/token',
    scope: 'read:jira-work read:jira-user read:me offline_access',
    extraAuthorize: { audience: 'api.atlassian.com', prompt: 'consent' } as Record<string, string>,
    form: false,
  },
} as const

export const isConfigured = (p: Provider) => isMock(p) || Boolean(PROVIDERS[p].clientId() && PROVIDERS[p].clientSecret())

// ── Signed state: who started the sign in, for which app, and where to return ──

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('SUPABASE_SERVICE_ROLE_KEY')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))
}

export type State = { u: string; p: Provider; r: string; x: number }

export async function signState(state: Omit<State, 'x'>) {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...state, x: Date.now() + 10 * 60_000 })))
  return `${body}.${await hmac(body)}`
}

export async function readState(raw: string | null): Promise<State | null> {
  if (!raw) return null
  const [body, sig] = raw.split('.')
  if (!body || !sig || sig !== await hmac(body)) return null
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as State
    return s.x > Date.now() ? s : null
  } catch { return null }
}

// ── Token exchange and refresh ──────────────────────────────────────────────

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number }

async function tokenRequest(p: Provider, params: Record<string, string>): Promise<TokenResponse> {
  const cfg = PROVIDERS[p]
  const body = { client_id: cfg.clientId(), client_secret: cfg.clientSecret(), ...params }
  const res = await fetch(cfg.tokenUrl(), cfg.form
    ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error_description ?? json.error ?? `Sign in failed (${res.status})`) as Error & { code?: string }
    err.code = json.error
    throw err
  }
  return json
}

export function authorizeUrl(p: Provider, state: string) {
  const cfg = PROVIDERS[p]
  const q = new URLSearchParams({
    client_id: cfg.clientId(), response_type: 'code', redirect_uri: callbackUrl(), scope: cfg.scope, state, ...cfg.extraAuthorize,
  })
  return `${cfg.authorizeUrl()}?${q}`
}

export const exchangeCode = (p: Provider, code: string) =>
  tokenRequest(p, { grant_type: 'authorization_code', code, redirect_uri: callbackUrl(), ...(p === 'teams' && { scope: PROVIDERS.teams.scope }) })

const expiry = (t: TokenResponse) => new Date(Date.now() + ((t.expires_in ?? 3600) - 120) * 1000).toISOString()

export type Connection = {
  user_id: string; provider: Provider; access_token: string; refresh_token: string | null; expires_at: string | null
  account_email: string | null; cloud_id: string | null; site_url: string | null
}

export async function saveConnection(db: SupabaseClient, row: Partial<Connection> & { user_id: string; provider: Provider }, t?: TokenResponse) {
  const data = {
    ...row,
    ...(t && { access_token: t.access_token, expires_at: expiry(t), ...(t.refresh_token && { refresh_token: t.refresh_token }) }),
    updated_at: new Date().toISOString(),
    last_error: null,
  }
  const { error } = await db.from('oauth_connections').upsert(data, { onConflict: 'user_id,provider' })
  if (error) throw error
}

// A usable access token, refreshed when it is about to expire. Both
// providers may rotate the refresh token, so the new one is stored. When the
// person revoked access, the connection is removed and null returned.
export async function accessToken(db: SupabaseClient, c: Connection): Promise<string | null> {
  if (isMock(c.provider)) return 'mock'
  if (c.expires_at && Date.parse(c.expires_at) > Date.now()) return c.access_token
  if (!c.refresh_token) return c.access_token
  try {
    const t = await tokenRequest(c.provider, {
      grant_type: 'refresh_token', refresh_token: c.refresh_token, ...(c.provider === 'teams' && { scope: PROVIDERS.teams.scope }),
    })
    await saveConnection(db, { user_id: c.user_id, provider: c.provider }, t)
    return t.access_token
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'invalid_grant' || code === 'unauthorized_client') {
      await db.from('oauth_connections').delete().eq('user_id', c.user_id).eq('provider', c.provider)
      return null
    }
    await db.from('oauth_connections').update({ last_error: String((e as Error).message).slice(0, 300) })
      .eq('user_id', c.user_id).eq('provider', c.provider)
    throw e
  }
}
