import { useState } from 'react'
import { usePendingApprovals, useApprovalMutations } from '../../hooks/useTeam'
import { formatDisplay } from '../../utils/dates'
import Card from '../../components/ui/Card'

const ROLES = ['employee', 'manager', 'admin']

function ApprovalRow({ person, onApprove, onReject, busy }) {
  const [role, setRole] = useState('employee')

  return (
    <div className="flex items-center justify-between px-5 py-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
          <span className="text-primary-700 text-xs font-bold">
            {person.name?.slice(0, 2).toUpperCase() ?? '?'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{person.name}</p>
          <p className="text-xs text-gray-400 truncate">{person.email}</p>
          <p className="text-[10px] text-gray-300">Requested {formatDisplay(person.created_at.slice(0, 10))}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 capitalize focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>
        <button
          onClick={() => onApprove(person.id, role)}
          disabled={busy}
          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => { if (confirm(`Reject ${person.name}?`)) onReject(person.id) }}
          disabled={busy}
          className="px-3 py-1.5 text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

export default function Approvals() {
  const { data: pending = [], isLoading } = usePendingApprovals()
  const { approve, reject } = useApprovalMutations()
  const busy = approve.isPending || reject.isPending

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Pending approvals</h2>
        <p className="text-sm text-gray-400">Review people who signed up and grant them a role.</p>
      </div>

      {isLoading ? (
        <Card className="h-32 animate-pulse bg-gray-50" />
      ) : pending.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-gray-400">No pending requests. You're all caught up.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-gray-50">
          {pending.map(person => (
            <ApprovalRow
              key={person.id}
              person={person}
              busy={busy}
              onApprove={(id, role) => approve.mutate({ id, role })}
              onReject={(id) => reject.mutate(id)}
            />
          ))}
        </Card>
      )}
    </div>
  )
}
