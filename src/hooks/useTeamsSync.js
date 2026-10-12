import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

async function call(body) {
  const { data, error } = await supabase.functions.invoke('teams-sync', { body })
  if (error) {
    let message = error.message
    try { message = (await error.context.json()).error ?? message } catch { /* not JSON */ }
    throw new Error(message)
  }
  return data
}

// { configured, enabled, mock }: is Microsoft 365 connected and switched on?
export function useTeamsStatus() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['teams_status'],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    retry: false,
    queryFn: () => call({ action: 'status' }),
  })
}

export function useTeamsSync() {
  const qc = useQueryClient()
  const { refreshProfile } = useAuth()
  return useMutation({
    mutationFn: scope => call({ scope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['facts'] })
      qc.invalidateQueries({ queryKey: ['sync_runs'] })
      refreshProfile()
    },
  })
}

export function useSyncRuns({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['sync_runs'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(8)
      if (error) throw error
      return data
    },
  })
}

// Quietly pull the latest meetings when someone opens their day, at most
// every 30 minutes, so nobody has to remember to sync.
export function useAutoTeamsSync() {
  const { profile } = useAuth()
  const { data: status } = useTeamsStatus()
  const sync = useTeamsSync()
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !status?.configured || !status.enabled || !profile?.calendar_sync) return
    const last = profile.calendar_synced_at ? Date.parse(profile.calendar_synced_at) : 0
    if (Date.now() - last < 30 * 60 * 1000) return
    started.current = true
    sync.mutate('me')
  }, [status, profile, sync])

  return { status, syncing: sync.isPending, sync }
}
