import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeam } from '../../hooks/useTeam'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

function MemberCard({ member, onClick }) {
  return (
    <Card
      className="p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">{member.avatar_initials}</span>
        </div>
        <Badge variant={member.submittedToday ? 'submitted' : 'missing'}>
          {member.submittedToday ? 'Submitted' : 'Missing'}
        </Badge>
      </div>
      <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
      <p className="text-xs text-gray-400 capitalize mb-3">{member.role}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-orange-500 font-medium">🔥 {member.streak} streak</span>
        <span className="text-gray-400">{member.completionRate}% done</span>
      </div>
    </Card>
  )
}

export default function PeopleView() {
  const navigate = useNavigate()
  const { data: members = [], isLoading } = useTeam()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const submittedCount = members.filter(m => m.submittedToday).length
  const alertMembers = members.filter(m => m.missingDays >= 3)

  const filtered = useMemo(() => members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' ? true : statusFilter === 'submitted' ? m.submittedToday : !m.submittedToday
    return matchSearch && matchStatus
  }), [members, search, statusFilter])

  return (
    <div className="space-y-5">
      {alertMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-800 font-medium">
            ⚠️ {alertMembers.length} member{alertMembers.length > 1 ? "s haven't" : " hasn't"} submitted in 3+ days
          </span>
          <button onClick={() => setStatusFilter('missing')} className="text-xs text-amber-700 underline hover:no-underline">
            View
          </button>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">Today's submissions</span>
          <span className="text-sm text-gray-500">{submittedCount} / {members.length}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all"
            style={{ width: members.length ? `${(submittedCount / members.length) * 100}%` : '0%' }}
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        {['all', 'submitted', 'missing'].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Card key={i} className="h-36 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(member => (
            <MemberCard key={member.id} member={member} onClick={() => navigate(`/admin/member/${member.id}`)} />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-12">No members match your filter.</p>
      )}
    </div>
  )
}
