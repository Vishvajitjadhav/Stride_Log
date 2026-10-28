import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { addDaysISO } from '../utils/dates'

const COLS = 'id, user_id, date, title, status, due_date, completed_on, project_id, project, source, description, external_id, external_url, changed_at, assigned_by, category, category_color'

// Everything the Team board needs for a period: open tasks planned up to 30
// days before it, tasks finished in it, and (managers) Jira issues nobody in
// StrideLog owns. RLS decides whose tasks come back.
export function useBoard({ from, to, userId, withIssues = false, enabled = true }) {
  return useQuery({
    queryKey: ['facts', 'board', from, to, userId ?? null, withIssues],
    enabled: Boolean(enabled && from && to),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const openFrom = addDaysISO(from, -30)
      const tasks = []
      for (let page = 0; ; page++) {
        let q = supabase.from('v_task_facts').select(COLS)
          .or(`and(date.gte.${openFrom},date.lte.${to}),and(completed_on.gte.${from},completed_on.lte.${to})`)
          .order('date').range(page * 1000, page * 1000 + 999)
        if (userId) q = q.eq('user_id', userId)
        const { data, error } = await q
        if (error) throw error
        tasks.push(...data)
        if (data.length < 1000) break
      }
      let issues = []
      if (withIssues) {
        const { data, error } = await supabase.from('jira_issues').select('*')
        if (error) throw error
        issues = data
      }
      return { tasks, issues }
    },
  })
}
