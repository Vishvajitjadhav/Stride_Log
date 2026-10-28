import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// The two connected apps. Each person connects their own Microsoft or
// Atlassian account; `flag` pauses syncing, `syncedAt` is the last sync,
// `every` is how often opening My Day re-syncs (minutes).
export const INTEGRATIONS = {
  teams: { fn: 'teams-sync', flag: 'calendar_sync', syncedAt: 'calendar_synced_at', every: 30 },
  jira: { fn: 'jira-sync', flag: 'jira_sync', syncedAt: 'jira_synced_at', every: 10 },
}

async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let message = error.message
    try { message = (await error.context.json()).error ?? message } catch { /* not JSON */ }
    throw new Error(message)
  }
  return data
}

// { teams: { configured, enabled, connected, account_email, ... }, jira: {...} }
function useConnections() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['connections', userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => invoke('connect', { action: 'status' }),
  })
}

export function useIntegrationStatus(kind) {
  const q = useConnections()
  return { ...q, data: q.data?.[kind] }
}

function useRefreshAfterSync() {
  const qc = useQueryClient()
  const { refreshProfile } = useAuth()
  return () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['facts'] })
    qc.invalidateQueries({ queryKey: ['sync_runs'] })
    qc.invalidateQueries({ queryKey: ['connections'] })
    refreshProfile()
  }
}

export function useIntegrationSync(kind) {
  const refresh = useRefreshAfterSync()
  return useMutation({ mutationFn: scope => invoke(INTEGRATIONS[kind].fn, { scope }), onSuccess: refresh })
}

// Send the browser to Microsoft / Atlassian sign in; it comes back to
// /profile?connected=teams (or ?connect_error=...).
export function useConnect(kind) {
  return useMutation({
    mutationFn: async () => {
      const { url } = await invoke('connect', { action: 'start', provider: kind })
      window.location.assign(url)
    },
  })
}

// Forget the account; with remove, unfinished synced tasks are cleared too.
export function useDisconnect(kind) {
  const refresh = useRefreshAfterSync()
  return useMutation({
    mutationFn: ({ remove }) => invoke('connect', { action: 'disconnect', provider: kind, remove }),
    onSuccess: refresh,
  })
}

// Admins: how many people connected each app.
export function useConnectionCounts({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['connection_counts'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('connection_counts')
      if (error) throw error
      return Object.fromEntries(data.map(r => [r.provider, r.people]))
    },
  })
}

export function useSyncRuns(source, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['sync_runs', source],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('sync_runs').select('*')
        .eq('source', source).order('started_at', { ascending: false }).limit(8)
      if (error) throw error
      return data
    },
  })
}

// Quietly pull the latest when someone opens their day, so nobody has to
// remember to sync.
export function useAutoSync(kind) {
  const { profile } = useAuth()
  const { data: status } = useIntegrationStatus(kind)
  const sync = useIntegrationSync(kind)
  const started = useRef(false)
  const { flag, syncedAt, every } = INTEGRATIONS[kind]
  const active = Boolean(status?.configured && status.enabled && status.connected && profile?.[flag])

  useEffect(() => {
    if (started.current || !active) return
    const last = profile[syncedAt] ? Date.parse(profile[syncedAt]) : 0
    if (Date.now() - last < every * 60 * 1000) return
    started.current = true
    sync.mutate('me')
  }, [active, profile, sync, syncedAt, every])

  return { status, active, syncing: sync.isPending, sync }
}

// ── Company Jira (admins) ───────────────────────────────────────────────────

// { on, mine, owner, account_email, site_url, broken }
export function useCompanyJira({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['company_jira'],
    enabled,
    retry: false,
    queryFn: () => invoke('connect', { action: 'company_status' }),
  })
}

// Jira projects the company connection can see: [{ key, name }]
export function useJiraProjects({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['company_jira', 'projects'],
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => (await invoke('connect', { action: 'company_projects' })).projects,
  })
}

// Projects the company reads: [{ jira_key, jira_name, project_id }]
export function useJiraLinks() {
  return useQuery({
    queryKey: ['jira_links'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jira_project_links').select('*').order('jira_name')
      if (error) throw error
      return data
    },
  })
}

export function useCompanyJiraMutations() {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['company_jira'] })
    qc.invalidateQueries({ queryKey: ['connections'] })
    qc.invalidateQueries({ queryKey: ['jira_links'] })
  }
  const use = useMutation({ mutationFn: () => invoke('connect', { action: 'company_use' }), onSuccess: done })
  const stop = useMutation({ mutationFn: () => invoke('connect', { action: 'company_stop' }), onSuccess: done })
  // Replace the chosen projects: links = [{ jira_key, jira_name, project_id }]
  const saveLinks = useMutation({
    mutationFn: async links => {
      const del = await supabase.from('jira_project_links').delete().neq('jira_key', '')
      if (del.error) throw del.error
      if (links.length) {
        const ins = await supabase.from('jira_project_links').insert(links)
        if (ins.error) throw ins.error
      }
    },
    onSuccess: done,
  })
  return { use, stop, saveLinks }
}
