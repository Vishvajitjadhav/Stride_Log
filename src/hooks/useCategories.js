import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useCategories({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['categories', includeInactive],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      let q = supabase.from('categories').select('*').order('name')
      if (!includeInactive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useCategoryMutations() {
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['categories'] })
  return {
    save: useMutation({
      mutationFn: async ({ id, ...fields }) => {
        const q = id
          ? supabase.from('categories').update(fields).eq('id', id)
          : supabase.from('categories').insert(fields)
        const { error } = await q
        if (error) throw error
      },
      onSuccess,
    }),
  }
}
