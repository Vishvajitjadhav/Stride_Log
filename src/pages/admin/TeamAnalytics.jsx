import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'
import { useTeamAnalytics } from '../../hooks/useTeamAnalytics'
import { getDateRange, formatDisplay, todayISO } from '../../utils/dates'
import { taskCompletion, tasksPerDay, categoryTotals, perEmployee } from '../../utils/analytics'
import { toCSV, downloadCSV } from '../../utils/csv'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

const FILTERS = ['daily', 'weekly', 'monthly', 'custom']

function StatCard({ value, label, color = 'text-primary-600' }) {
  return (
    <Card className="p-4 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{label}</p>
    </Card>
  )
}

export default function TeamAnalytics() {
  const navigate = useNavigate()
  const today = todayISO()
  const [filter, setFilter] = useState('weekly')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [employee, setEmployee] = useState('all')
  const [category, setCategory] = useState('all')

  const range = useMemo(() => {
    if (filter === 'custom') return { from: customFrom, to: customTo }
    return getDateRange(filter)
  }, [filter, customFrom, customTo])

  const { data, isLoading } = useTeamAnalytics(range.from, range.to)
  const profiles = useMemo(() => data?.profiles ?? [], [data])
  const rawLogs = useMemo(() => data?.logs ?? [], [data])
  const profilesById = useMemo(
    () => Object.fromEntries(profiles.map(p => [p.id, p])),
    [profiles]
  )

  const categoryOptions = useMemo(() => {
    const names = new Set()
    rawLogs.forEach(l => (l.tasks ?? []).forEach(t => names.add(t.categories?.name ?? 'Uncategorized')))
    return [...names].sort()
  }, [rawLogs])

  // Apply employee + category filters (category filters at the task level)
  const logs = useMemo(() => rawLogs
    .filter(l => employee === 'all' || l.user_id === employee)
    .map(l => ({
      ...l,
      tasks: (l.tasks ?? []).filter(t => category === 'all' || (t.categories?.name ?? 'Uncategorized') === category),
    })), [rawLogs, employee, category])

  const allTasks = useMemo(() => logs.flatMap(l => l.tasks ?? []), [logs])
  const completion = useMemo(() => taskCompletion(allTasks), [allTasks])
  const perDay = useMemo(() => tasksPerDay(logs), [logs])
  const byCategory = useMemo(() => categoryTotals(allTasks), [allTasks])
  const perPerson = useMemo(() => perEmployee(logs, profilesById), [logs, profilesById])

  const activeMembers = useMemo(
    () => new Set(logs.filter(l => (l.tasks?.length ?? 0) > 0 || l.submitted_at).map(l => l.user_id)).size,
    [logs]
  )

  function handleExport() {
    const rows = logs.flatMap(l => (l.tasks ?? []).map(t => ({
      date: l.date,
      employee: profilesById[l.user_id]?.name ?? 'Unknown',
      task: t.title,
      status: t.status,
      category: t.categories?.name ?? '',
      hours: t.hours ?? '',
    })))
    const csv = toCSV(rows, [
      { key: 'date', label: 'Date' },
      { key: 'employee', label: 'Employee' },
      { key: 'task', label: 'Task' },
      { key: 'status', label: 'Status' },
      { key: 'category', label: 'Category' },
      { key: 'hours', label: 'Hours' },
    ])
    downloadCSV(`stridelog_${range.from}_to_${range.to}.csv`, csv)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team Analytics</h2>
          <p className="text-sm text-gray-400">{formatDisplay(range.from)} → {formatDisplay(range.to)}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!allTasks.length}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          ↧ Download CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >{f}</button>
        ))}
        {filter === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={customTo} min={customFrom} max={today} onChange={e => setCustomTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400" />
          </div>
        )}
        <div className="flex-1" />
        <select value={employee} onChange={e => setEmployee(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400">
          <option value="all">All employees</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400">
          <option value="all">All categories</option>
          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard value={completion.total} label="Total tasks" />
        <StatCard value={completion.done} label="Tasks done" color="text-green-600" />
        <StatCard value={`${completion.rate}%`} label="Completion rate" color="text-primary-600" />
        <StatCard value={activeMembers} label="Active members" color="text-orange-500" />
      </div>

      {isLoading ? (
        <Card className="h-64 animate-pulse bg-gray-50" />
      ) : !allTasks.length ? (
        <Card className="p-12 text-center text-sm text-gray-400">No activity for this range / filter.</Card>
      ) : (
        <>
          {/* Tasks per day */}
          <Card className="p-5">
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-4">Tasks per day</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={perDay} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name="Logged" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="done" name="Done" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Per-employee comparison */}
            <Card className="p-5">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-4">Tasks done by employee</p>
              <ResponsiveContainer width="100%" height={Math.max(160, perPerson.length * 34)}>
                <BarChart data={perPerson} layout="vertical" barSize={16}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
                  <Bar dataKey="done" name="Done" fill="#7c3aed" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Category breakdown */}
            <Card className="p-5">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-4">Work by category</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCategory} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                    {byCategory.map(c => <Cell key={c.name} fill={c.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Per-employee table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">By employee</p>
            </div>
            <div className="divide-y divide-gray-50">
              {perPerson.map(p => (
                <button
                  key={p.userId}
                  onClick={() => navigate(`/admin/member/${p.userId}`)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{p.avatar_initials ?? p.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400">{p.days} days</span>
                    <span className="text-gray-600">{p.done}/{p.total} done</span>
                    <Badge variant={p.rate >= 70 ? 'submitted' : p.rate >= 40 ? 'in_progress' : 'missing'}>{p.rate}%</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
