import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useNotifications() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const key = ['notifications', userId]

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', userId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, qc])

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const unread = (query.data ?? []).filter(n => !n.read_at).length
  return { ...query, unread, markAllRead }
}
