import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTeams } from '../hooks/useOrg'
import { ROLE_LABELS } from '../lib/permissions'
import { getInitials } from '../utils/initials'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Avatar from '../components/ui/Avatar'
import InstallCard from '../components/InstallCard'

const PREFS = [
  { key: 'assigned', label: 'A task is assigned to me' },
  { key: 'updated', label: 'Someone updates one of my tasks' },
  { key: 'reminder', label: '6 pm reminder if I haven’t submitted my day' },
  { key: 'weekly', label: 'Monday weekly summary (managers, HR, admins)' },
]

export default function Profile() {
  const { profile, user, updateProfile, updatePassword, signOut } = useAuth()
  const { data: teams = [] } = useTeams()
  const [name, setName] = useState(profile.name)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [msg, setMsg] = useState({})
  const team = teams.find(t => t.id === profile.team_id)
  const prefs = profile.email_prefs ?? {}

  async function saveName(e) {
    e.preventDefault()
    const { error } = await updateProfile({ name: name.trim(), avatar_initials: getInitials(name) })
    setMsg({ name: error ? error.message : 'Saved ✓' })
  }

  async function togglePref(key) {
    await updateProfile({ email_prefs: { ...prefs, [key]: !(prefs[key] ?? true) } })
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pw.next.length < 8) return setMsg({ pw: 'Use at least 8 characters.' })
    if (pw.next !== pw.confirm) return setMsg({ pw: 'Passwords don’t match.' })
    const { error } = await updatePassword(pw.next)
    setMsg({ pw: error ? error.message : 'Password changed ✓' })
    if (!error) setPw({ next: '', confirm: '' })
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card className="p-5 flex items-center gap-4">
        <Avatar person={profile} size="lg" />
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 truncate">{profile.name}</p>
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          <p className="text-xs text-gray-400">{ROLE_LABELS[profile.role]}{team ? ` · ${team.name}` : ''}{profile.can_assign_tasks ? ' · can assign tasks' : ''}</p>
        </div>
      </Card>

      <InstallCard />

      <Card className="p-5">
        <form onSubmit={saveName} className="space-y-3">
          <Input label="Display name" value={name} onChange={e => setName(e.target.value)} required />
          <div className="flex items-center justify-end gap-3">
            {msg.name && <span className="text-sm text-gray-500">{msg.name}</span>}
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Email me when…</p>
        {PREFS.map(p => (
          <label key={p.key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-700">{p.label}</span>
            <input type="checkbox" className="w-5 h-5 accent-primary-600" checked={prefs[p.key] ?? true} onChange={() => togglePref(p.key)} />
          </label>
        ))}
        <p className="text-xs text-gray-400">In-app notifications (the bell) are always on.</p>
      </Card>

      <Card className="p-5">
        <form onSubmit={changePassword} className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Change password</p>
          <Input label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
          <div className="flex items-center justify-end gap-3">
            {msg.pw && <span className="text-sm text-gray-500">{msg.pw}</span>}
            <Button type="submit" size="sm">Update password</Button>
          </div>
        </form>
      </Card>

      <Button variant="outline" className="w-full text-red-600" onClick={signOut}>Sign out</Button>
    </div>
  )
}
