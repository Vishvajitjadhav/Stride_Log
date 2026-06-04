import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMemberLogs } from '../../hooks/useTeam'
import { getDateRange, formatDisplay, todayISO } from '../../utils/dates'
import { calculateStreak } from '../../utils/streak'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

const FILTERS = ['daily', 'weekly', 'monthly', 'custom']

function useMemberProfile(id) {
  return useQuery({
    queryKey: ['profile', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const today = todayISO()
  const [filter, setFilter] = useState('monthly')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)

  const range = useMemo(() => {
    if (filter === 'custom') return { from: customFrom, to: customTo }
    return getDateRange(filter)
  }, [filter, customFrom, customTo])

  const { data: profile } = useMemberProfile(id)
  const { data: logs = [], isLoading } = useMemberLogs(id, range.from, range.to)

  const stats = useMemo(() => {
    const allTasks = logs.flatMap(l => l.tasks ?? [])
    const done = allTasks.filter(t => t.status === 'done').length
    const submittedDates = logs.filter(l => l.submitted_at).map(l => l.date)
    return {
      done,
      rate: allTasks.length ? Math.round((done / allTasks.length) * 100) : 0,
      streak: calculateStreak(submittedDates),
      submitted: submittedDates.length,
    }
  }, [logs])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        {profile && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">{profile.avatar_initials}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
              <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[['Tasks done', stats.done], ['Completion', `${stats.rate}%`], ['🔥 Streak', stats.streak], ['Days logged', stats.submitted]].map(([label, val]) => (
          <Card key={label} className="p-4 text-center">
            <p className="text-2xl font-black text-primary-600">{val}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >{f}</button>
        ))}
        {filter === 'custom' && (
          <div className="flex items-center gap-2 mt-1">
            <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={customTo} min={customFrom} max={today} onChange={e => setCustomTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400" />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-16 animate-pulse bg-gray-50" />)}
        {!isLoading && logs.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No entries in this range.</p>}
        {logs.map(log => {
          const tasks = log.tasks ?? []
          const done = tasks.filter(t => t.status === 'done').length
          return (
            <Card key={log.id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{formatDisplay(log.date)}</span>
                  <Badge variant={log.submitted_at ? 'submitted' : 'draft'}>{log.submitted_at ? 'Submitted' : 'Draft'}</Badge>
                </div>
                <span className="text-sm text-gray-400">{done}/{tasks.length} done</span>
              </div>
              {tasks.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      <Badge variant={t.status}>{t.status.replace('_', ' ')}</Badge>
                      <span className="text-sm text-gray-700">{t.title}</span>
                      {t.categories && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: t.categories.color + '22', color: t.categories.color }}>
                          {t.categories.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {log.blockers && (
                <p className="text-xs text-gray-400 mt-1">
                  <span className="font-medium text-gray-500">Blockers: </span>{log.blockers}
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
