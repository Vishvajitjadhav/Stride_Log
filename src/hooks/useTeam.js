import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { todayISO } from '../utils/dates'
import { calculateStreak } from '../utils/streak'

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const today = todayISO()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const from = thirtyDaysAgo.toISOString().slice(0, 10)

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error

      const { data: logs } = await supabase
        .from('work_logs')
        .select('user_id, date, submitted_at, tasks(status)')
        .gte('date', from)
        .not('submitted_at', 'is', null)

      const logsByUser = {}
      ;(logs ?? []).forEach(l => {
        if (!logsByUser[l.user_id]) logsByUser[l.user_id] = []
        logsByUser[l.user_id].push(l)
      })

      return profiles.map(p => {
        const userLogs = logsByUser[p.id] ?? []
        const submittedDates = userLogs.map(l => l.date)
        const streak = calculateStreak(submittedDates)
        const submittedToday = userLogs.some(l => l.date === today)
        const allTasks = userLogs.flatMap(l => l.tasks ?? [])
        const doneTasks = allTasks.filter(t => t.status === 'done').length
        const completionRate = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0

        const missingDays = [1, 2, 3].filter(d => {
          const date = new Date()
          date.setDate(date.getDate() - d)
          const iso = date.toISOString().slice(0, 10)
          return !submittedDates.includes(iso)
        }).length

        return { ...p, streak, submittedToday, completionRate, missingDays }
      })
    },
  })
}

export function useMemberLogs(userId, from, to) {
  return useQuery({
    queryKey: ['member_logs', userId, from, to],
    enabled: Boolean(userId && from && to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_logs')
        .select('*, tasks(*, categories(name, color))')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAllCategories() {
  return useQuery({
    queryKey: ['all_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCategoryMutations() {
  const qc = useQueryClient()

  const addCategory = useMutation({
    mutationFn: async ({ name, color }) => {
      const { error } = await supabase.from('categories').insert({ name, color })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all_categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const toggleCategory = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all_categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  return { addCategory, toggleCategory }
}

export function useDeactivateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

// Admin: people who self-registered and are waiting for approval.
export function usePendingApprovals({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['pending_approvals'],
    enabled,
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

export function useApprovalMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pending_approvals'] })
    qc.invalidateQueries({ queryKey: ['team'] })
  }

  const approve = useMutation({
    mutationFn: async ({ id, role }) => {
      const { error } = await supabase.from('profiles').update({ is_approved: true, role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: async (id) => {
      // Soft reject: keep unapproved and deactivate so they can't proceed.
      const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { approve, reject }
}
