import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Everyone in the directory. RLS: approved members can read all profiles.
export function usePeople({ includeInactive = false, enabled = true } = {}) {
  return useQuery({
    queryKey: ['people', includeInactive],
    enabled,
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').eq('is_approved', true).order('name')
      if (!includeInactive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function usePerson(id) {
  return useQuery({
    queryKey: ['person', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

// People who self-registered and are waiting for approval.
export function usePendingApprovals({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['pending_approvals'],
    enabled,
    refetchInterval: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .eq('is_approved', false)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useUpdatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { error } = await supabase.from('profiles').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['person', id] })
      qc.invalidateQueries({ queryKey: ['pending_approvals'] })
    },
  })
}

// HR/Admin: send an invite email with role & team pre-set (Edge Function,
// because inviting needs the service role key).
export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, name, role, team_id }) => {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, name, role, team_id, redirectTo: `${window.location.origin}/reset-password` },
      })
      if (error) {
        let message = error.message
        try { message = (await error.context.json()).error ?? message } catch { /* not JSON */ }
        throw new Error(message)
      }
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
}
