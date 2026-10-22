import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Company settings — public read (login page + reports), admin write.
export function useOrgSettings() {
  return useQuery({
    queryKey: ['org_settings'],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.from('org_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fields) => {
      const { error } = await supabase.from('org_settings').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org_settings'] }),
  })
}

export function useUploadLogo() {
  const update = useUpdateOrg()
  return useMutation({
    mutationFn: async (file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('branding').getPublicUrl(path)
      await update.mutateAsync({ logo_url: data.publicUrl })
      return data.publicUrl
    },
  })
}

// ── Holidays ────────────────────────────────────────────────────────────────

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').order('date')
      if (error) throw error
      return data
    },
    select: rows => ({ list: rows, set: new Set(rows.map(h => h.date)), byDate: Object.fromEntries(rows.map(h => [h.date, h.name])) }),
  })
}

export function useHolidayMutations() {
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['holidays'] })
  return {
    add: useMutation({
      mutationFn: async ({ date, name }) => {
        const { error } = await supabase.from('holidays').upsert({ date, name })
        if (error) throw error
      },
      onSuccess,
    }),
    // Bulk import: one request; an existing date gets the new name.
    addMany: useMutation({
      mutationFn: async (rows) => {
        const { error } = await supabase.from('holidays').upsert(rows.map(({ date, name }) => ({ date, name })))
        if (error) throw error
      },
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: async (date) => {
        const { error } = await supabase.from('holidays').delete().eq('date', date)
        if (error) throw error
      },
      onSuccess,
    }),
  }
}

// Managers and admins: what employees can see (team tasks, leaderboard).
//   mutate({ tasks: true }) or mutate({ leaderboard: false })
export function useTeamSharing() {
  const qc = useQueryClient()
  const { refreshSharing } = useAuth()
  return useMutation({
    mutationFn: async ({ tasks = null, leaderboard = null }) => {
      const { error } = await supabase.rpc('set_team_sharing', { p_tasks: tasks, p_leaderboard: leaderboard })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org_settings'] })
      refreshSharing()
    },
  })
}
