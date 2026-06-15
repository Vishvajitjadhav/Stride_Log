import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Commit mapped import days for a target user.
// days: [{ date, what_i_did, tasks: [{ title, status, hours, category }] }]
// autoCreateCategories: only enable for staff (RLS lets staff create categories).
export function useImport() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, days, autoCreateCategories = false }) => {
      // Resolve category names -> ids (match existing; optionally create missing)
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

      let logsCreated = 0
      let tasksCreated = 0

      for (const day of days) {
        const { data: log, error: logErr } = await supabase
          .from('work_logs')
          .upsert(
            { user_id: userId, date: day.date, what_i_did: day.what_i_did || null, submitted_at: new Date().toISOString() },
            { onConflict: 'user_id,date' }
          )
          .select('id')
          .single()
        if (logErr) throw logErr
        logsCreated++

        if (day.tasks.length) {
          const rows = day.tasks.map(t => ({
            log_id: log.id,
            user_id: userId,
            title: t.title,
            status: t.status,
            hours: t.hours,
            category_id: t.category ? catByName.get(t.category.toLowerCase()) ?? null : null,
          }))
          const { error: taskErr } = await supabase.from('tasks').insert(rows)
          if (taskErr) throw taskErr
          tasksCreated += rows.length
        }
      }

      return { logsCreated, tasksCreated }
    },
    onSuccess: () => {
      // Refresh dashboards, history and analytics
      qc.invalidateQueries()
    },
  })
}
