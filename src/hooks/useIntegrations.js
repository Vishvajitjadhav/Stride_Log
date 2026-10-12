import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// The two connected apps. `flag` is the person's on/off switch, `syncedAt`
// when their last sync finished, `every` how often opening My Day re-syncs.
export const INTEGRATIONS = {
  teams: { fn: 'teams-sync', flag: 'calendar_sync', syncedAt: 'calendar_synced_at', every: 30 },
  jira: { fn: 'jira-sync', flag: 'jira_sync', syncedAt: 'jira_synced_at', every: 10 },
}

async function call(kind, body) {
  const { data, error } = await supabase.functions.invoke(INTEGRATIONS[kind].fn, { body })
  if (error) {
    let message = error.message
    try { message = (await error.context.json()).error ?? message } catch { /* not JSON */ }
    throw new Error(message)
  }
  return data
}

// { configured, enabled, mock }: is the app connected and switched on for the company?
export function useIntegrationStatus(kind) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['integration_status', kind],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    retry: false,
    queryFn: () => call(kind, { action: 'status' }),
  })
}

function useRefreshAfterSync() {
  const qc = useQueryClient()
  const { refreshProfile } = useAuth()
  return () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['facts'] })
    qc.invalidateQueries({ queryKey: ['sync_runs'] })
    refreshProfile()
  }
}

export function useIntegrationSync(kind) {
  const refresh = useRefreshAfterSync()
  return useMutation({ mutationFn: scope => call(kind, { scope }), onSuccess: refresh })
}

// Turn sync off for me; with remove, unfinished synced tasks are cleared too.
export function useDisconnect(kind) {
  const refresh = useRefreshAfterSync()
  const { updateProfile, userId } = useAuth()
  return useMutation({
    mutationFn: async ({ remove }) => {
      if (kind === 'jira') return call('jira', { action: 'disconnect', remove })
      await updateProfile({ calendar_sync: false })
      if (!remove) return { removed: 0 }
      const { data, error } = await supabase.from('tasks').delete()
        .eq('user_id', userId).eq('source', 'teams').neq('status', 'done').gte('date', new Date().toISOString().slice(0, 10)).select('id')
      if (error) throw error
      return { removed: data.length }
    },
    onSuccess: refresh,
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
// remember to sync. Jira also updates instantly through its webhook.
export function useAutoSync(kind) {
  const { profile } = useAuth()
  const { data: status } = useIntegrationStatus(kind)
  const sync = useIntegrationSync(kind)
  const started = useRef(false)
  const { flag, syncedAt, every } = INTEGRATIONS[kind]
  const active = Boolean(status?.configured && status.enabled && profile?.[flag])

  useEffect(() => {
    if (started.current || !active) return
    const last = profile[syncedAt] ? Date.parse(profile[syncedAt]) : 0
    if (Date.now() - last < every * 60 * 1000) return
    started.current = true
    sync.mutate('me')
  }, [active, profile, sync, syncedAt, every])

  return { status, active, syncing: sync.isPending, sync }
}
