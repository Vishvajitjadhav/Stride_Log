import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { todayISO } from '../utils/dates'

export function useWorkLog(date = todayISO()) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['work_log', userId, date],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const upsert = useMutation({
    mutationFn: async (fields) => {
      const { data, error } = await supabase
        .from('work_logs')
        .upsert({ user_id: userId, date, ...fields }, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work_log', userId, date] }),
  })

  const submit = useMutation({
    mutationFn: async (logId) => {
      const { error } = await supabase
        .from('work_logs')
        .update({ submitted_at: new Date().toISOString() })
        .eq('id', logId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work_log', userId, date] }),
  })

  const unsubmit = useMutation({
    mutationFn: async (logId) => {
      const { error } = await supabase
        .from('work_logs')
        .update({ submitted_at: null })
        .eq('id', logId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work_log', userId, date] }),
  })

  return { ...query, upsert, submit, unsubmit }
}

export function useWorkLogRange(from, to) {
  const { session } = useAuth()
  const userId = session?.user?.id

  return useQuery({
    queryKey: ['work_logs_range', userId, from, to],
    enabled: Boolean(userId && from && to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*, tasks(*)')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
