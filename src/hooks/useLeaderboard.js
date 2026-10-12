import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Scores are computed in the database (leaderboard() in
// supabase/migrations/*_leaderboard_sharing.sql). Managers get everyone;
// employees only get the top five, badge winners and themselves.
export function useLeaderboard({ from, to }) {
  return useQuery({
    queryKey: ['leaderboard', from, to],
    enabled: Boolean(from && to),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leaderboard', { p_from: from, p_to: to })
      if (error) throw error
      return data
    },
  })
}

// What each part of the score means, shared by the page and its tooltips.
export const SCORE_PARTS = [
  { key: 'consistency', label: 'Consistency', weight: 30, tip: 'Working days with a submitted daily log. Shows up, plans and closes the day.' },
  { key: 'follow_through', label: 'Follow through', weight: 30, tip: 'Share of planned tasks that were finished. Big or small, it is about finishing what you set out to do.' },
  { key: 'on_time', label: 'On time', weight: 25, tip: 'Assigned tasks with a due date that were finished by that date. Counted once at least two were due.' },
  { key: 'growth', label: 'Growth', weight: 15, tip: 'Improvement in consistency and follow through compared with the previous period. 50 means steady.' },
]

export const BADGES = {
  consistent: { label: 'Most consistent', icon: 'today', tip: 'Highest share of working days logged.' },
  finisher: { label: 'Best finisher', icon: 'check', tip: 'Finished the highest share of planned tasks.' },
  reliable: { label: 'Most reliable', icon: 'flag', tip: 'Delivered the most assigned work on time.' },
  improved: { label: 'Most improved', icon: 'analytics', tip: 'Biggest step up compared with the previous period.' },
}
