import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { todayISO } from '../utils/dates'

// One person's daily notes (what I did / blockers / tomorrow) + submission.
export function useWorkLog(date = todayISO(), userId, { enabled = true } = {}) {
  const { userId: me } = useAuth()
  const uid = userId ?? me
  const qc = useQueryClient()
  const key = ['work_log', uid, date]

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(uid && enabled),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', uid)
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['work_logs_range'] })
    qc.invalidateQueries({ queryKey: ['facts'] })
  }

  const save = useMutation({
    mutationFn: async (fields) => {
      const { data, error } = await supabase
        .from('work_logs')
        .upsert({ user_id: uid, date, ...fields }, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  return { ...query, save, invalidate }
}

export function useWorkLogRange(from, to, userId) {
  const { userId: me } = useAuth()
  const uid = userId ?? me

  return useQuery({
    queryKey: ['work_logs_range', uid, from, to],
    enabled: Boolean(uid && from && to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*, tasks(id, title, status, date, assigned_by, categories(name, color))')
        .eq('user_id', uid)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
