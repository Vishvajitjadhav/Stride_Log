import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Staff-only: fetch every active member + all work logs (with tasks) in a date
// range. Aggregation lives in src/utils/analytics.js so this hook stays thin.
// RLS ("staff read profiles/logs/tasks") permits this for admins and managers.
export function useTeamAnalytics(from, to) {
  return useQuery({
    queryKey: ['team_analytics', from, to],
    enabled: Boolean(from && to),
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, avatar_initials, role')
        .eq('is_active', true)
        .order('name')
      if (pErr) throw pErr

      const { data: logs, error: lErr } = await supabase
        .from('work_logs')
        .select('user_id, date, what_i_did, submitted_at, tasks(title, status, hours, categories(name, color))')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
      if (lErr) throw lErr

      return { profiles: profiles ?? [], logs: logs ?? [] }
    },
  })
}
