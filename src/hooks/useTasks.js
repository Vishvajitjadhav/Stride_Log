import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { todayISO, addDaysISO } from '../utils/dates'

// Unfinished tasks older than this stop following you around in My Day
// (they're still in History, the calendar and reports).
export const CARRY_OVER_DAYS = 30

export const TASK_SELECT = `
  *,
  categories(name, color),
  assigner:profiles!tasks_assigned_by_fkey(id, name),
  editor:profiles!tasks_updated_by_fkey(id, name),
  owner:profiles!tasks_user_id_fkey(id, name, avatar_initials)
`

// A person's list for one day. For today (or any day viewed "live") unfinished
// tasks from earlier days are carried over so nothing silently disappears, and
// carried tasks finished today stay visible under Done.
export function useDayTasks(userId, date = todayISO(), { carryOver = true } = {}) {
  return useQuery({
    queryKey: ['tasks', 'day', userId, date, carryOver],
    enabled: Boolean(userId && date),
    queryFn: async () => {
      let q = supabase.from('tasks').select(TASK_SELECT).eq('user_id', userId)
      q = carryOver
        ? q.or(`date.eq.${date},completed_on.eq.${date},and(date.lt.${date},date.gte.${addDaysISO(date, -CARRY_OVER_DAYS)},status.neq.done)`)
        : q.eq('date', date)
      const { data, error } = await q.order('date').order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useTaskRange({ userId, from, to, enabled = true }) {
  return useQuery({
    queryKey: ['tasks', 'range', userId, from, to],
    enabled: Boolean(enabled && from && to),
    queryFn: async () => {
      let q = supabase.from('tasks').select(TASK_SELECT).gte('date', from).lte('date', to)
      if (userId) q = q.eq('user_id', userId)
      const { data, error } = await q.order('date', { ascending: false }).order('created_at')
      if (error) throw error
      return data
    },
  })
}

// Tasks I handed out to other people.
export function useAssignedByMe({ status = 'open' } = {}) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'assigned_by', userId, status],
    enabled: Boolean(userId),
    queryFn: async () => {
      let q = supabase.from('tasks').select(TASK_SELECT).eq('assigned_by', userId)
      if (status === 'open') q = q.neq('status', 'done')
      else if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).order('date', { ascending: false }).limit(300)
      if (error) throw error
      return data
    },
  })
}

export function useTaskMutations() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['work_log'] })
    qc.invalidateQueries({ queryKey: ['facts'] })
  }

  const add = useMutation({
    mutationFn: async (task) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ user_id: userId, date: todayISO(), status: 'pending', ...task })
        .select(TASK_SELECT)
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { error } = await supabase.from('tasks').update(fields).eq('id', id)
      if (error) throw error
    },
    // Optimistic so status taps feel instant on mobile.
    onMutate: async ({ id, ...fields }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const snapshots = qc.getQueriesData({ queryKey: ['tasks'] })
      snapshots.forEach(([key, rows]) => {
        if (Array.isArray(rows)) qc.setQueryData(key, rows.map(r => (r.id === id ? { ...r, ...fields } : r)))
      })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, rows]) => qc.setQueryData(key, rows)),
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { add, update, remove }
}

// Live updates: when a manager assigns or edits one of my tasks it appears
// without a refresh.
export function useTasksRealtime(userId) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`tasks:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['tasks'] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, qc])
}
