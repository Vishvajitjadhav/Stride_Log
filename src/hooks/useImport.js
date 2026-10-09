import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Commit mapped import days for a target user in one transaction (import_work
// RPC — no notifications, RLS decides whose history you may write).
// days: [{ date, what_i_did, tasks: [{ title, status, category }] }]
// autoCreateCategories: only for roles that may manage categories.
export function useImport() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, days, autoCreateCategories = false }) => {
      const { data: cats } = await supabase.from('categories').select('id, name')
      const catByName = new Map((cats ?? []).map(c => [c.name.toLowerCase(), c.id]))

      if (autoCreateCategories) {
        const needed = new Set()
        days.forEach(d => d.tasks.forEach(t => { if (t.category) needed.add(t.category) }))
        for (const name of needed) {
          if (!catByName.has(name.toLowerCase())) {
            const { data, error } = await supabase.from('categories').insert({ name }).select('id').single()
            if (!error && data) catByName.set(name.toLowerCase(), data.id)
          }
        }
      }

      const payload = days.map(d => ({
        date: d.date,
        what_i_did: d.what_i_did || '',
        tasks: d.tasks.map(t => ({
          title: t.title,
          status: t.status,
          category_id: t.category ? catByName.get(t.category.toLowerCase()) ?? '' : '',
        })),
      }))

      const { data, error } = await supabase.rpc('import_work', { p_user_id: userId, p_days: payload })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}
