import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useTasks(logId) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['tasks', logId],
    enabled: Boolean(logId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, categories(name, color)')
        .eq('log_id', logId)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const addTask = useMutation({
    mutationFn: async (task) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...task, log_id: logId, user_id: userId })
        .select('*, categories(name, color)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', logId] }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const { error } = await supabase.from('tasks').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', logId] }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', logId] }),
  })

  return { ...query, addTask, updateTask, deleteTask }
}
