import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useWorkLog } from '../hooks/useWorkLog'
import { getGreeting, todayISO, formatDisplay } from '../utils/dates'
import { calculateStreak } from '../utils/streak'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

function useDashboardData() {
  const { session } = useAuth()
  const userId = session?.user?.id

  return useQuery({
    queryKey: ['dashboard', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const from = thirtyDaysAgo.toISOString().slice(0, 10)

      const { data: logs } = await supabase
        .from('work_logs')
        .select('date, submitted_at, tasks(status)')
        .eq('user_id', userId)
        .gte('date', from)
        .order('date', { ascending: false })

      return logs ?? []
    },
  })
}

function StatCard({ value, label, color = 'text-primary-600' }) {
  return (
    <Card className="p-5 text-center">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const today = todayISO()
  const { data: todayLog } = useWorkLog(today)
  const { data: logs = [], isLoading } = useDashboardData()

  const stats = useMemo(() => {
    const submittedDates = logs.filter(l => l.submitted_at).map(l => l.date)
    const streak = calculateStreak(submittedDates)
    const allTasks = logs.flatMap(l => l.tasks ?? [])
    const doneTasks = allTasks.filter(t => t.status === 'done').length
    const completionRate = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0
    const monthTasks = logs
      .filter(l => l.date.startsWith(today.slice(0, 7)))
      .flatMap(l => l.tasks ?? [])
      .filter(t => t.status === 'done').length
    return { streak, completionRate, monthTasks }
  }, [logs, today])

  const chartData = useMemo(() =>
    [...logs].reverse().slice(-14).map(l => ({
      date: l.date.slice(5),
      tasks: (l.tasks ?? []).length,
    }))
  , [logs])

  const isSubmittedToday = Boolean(todayLog?.submitted_at)
  const isLate = new Date().getHours() >= 18

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {profile?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{formatDisplay(today)}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => navigate('/log')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isSubmittedToday
                ? 'bg-green-100 text-green-700'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {isSubmittedToday ? '✓ Submitted' : '+ Log Today'}
          </button>
          {!isSubmittedToday && isLate && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Card key={i} className="p-5 h-24 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <StatCard value={stats.monthTasks} label="Tasks done this month" />
          <StatCard value={`🔥 ${stats.streak}`} label="Day streak" color="text-orange-500" />
          <StatCard value={`${stats.completionRate}%`} label="Completion rate" color="text-green-600" />
        </div>
      )}

      <Card className="p-5">
        <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-4">Activity — last 14 days</p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData} barSize={14}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              formatter={(v) => [`${v} tasks`, '']}
            />
            <Bar dataKey="tasks" fill="#7c3aed" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Recent entries</p>
        <div className="space-y-2">
          {logs.slice(0, 5).map(log => {
            const tasks = log.tasks ?? []
            const done = tasks.filter(t => t.status === 'done').length
            return (
              <Card
                key={log.date}
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:border-primary-200 transition-colors"
                onClick={() => navigate('/history')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{formatDisplay(log.date)}</span>
                  <Badge variant={log.submitted_at ? 'submitted' : 'draft'}>
                    {log.submitted_at ? 'Submitted' : 'Draft'}
                  </Badge>
                </div>
                <span className="text-sm text-gray-400">{done}/{tasks.length} done</span>
              </Card>
            )
          })}
          {logs.length === 0 && !isLoading && (
            <p className="text-sm text-gray-400 text-center py-8">No entries yet. Start by logging today!</p>
          )}
        </div>
      </div>
    </div>
  )
}
