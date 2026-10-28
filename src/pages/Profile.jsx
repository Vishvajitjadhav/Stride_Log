import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProjects, projectsOf } from '../hooks/useProjects'
import { ROLE_LABELS, isTracked } from '../lib/permissions'
import { getInitials } from '../utils/initials'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Avatar from '../components/ui/Avatar'
import InstallCard from '../components/InstallCard'
import Icon from '../components/ui/Icon'
import { useTheme } from '../lib/theme'
import AvatarEditor from '../components/AvatarEditor'
import Switch from '../components/ui/Switch'
import ConnectedApps from '../components/integrations/ConnectedApps'

// Everything shows in the bell. Only the main events can also be emailed;
// task updates stay in the app so inboxes are not flooded.
const NOTIFICATIONS = [
  { key: 'assigned', label: 'A task is assigned to me', email: true },
  { key: 'reminder', label: 'Evening reminder at 6 pm if I have logged no work today', email: true, tracked: true },
  { key: 'weekly', label: 'Monday weekly team summary', email: true, reviewers: true },
  { key: 'updated', label: 'Someone updates one of my tasks', email: false },
]

export default function Profile() {
  const { profile, user, can, updateProfile, updatePassword, signOut } = useAuth()
  const { data: projects = [] } = useProjects()
  const [name, setName] = useState(profile.name)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [msg, setMsg] = useState({})
  const { pref, setTheme } = useTheme()
  const [photo, setPhoto] = useState(false)
  const projectNames = projectsOf(projects, profile.id).map(p => p.name).join(', ')
  const prefs = profile.email_prefs ?? {}

  async function saveName(e) {
    e.preventDefault()
    const { error } = await updateProfile({ name: name.trim(), avatar_initials: getInitials(name) })
    setMsg({ name: error ? error.message : 'Saved' })
  }

  async function togglePref(key) {
    await updateProfile({ email_prefs: { ...prefs, [key]: !(prefs[key] ?? true) } })
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pw.next.length < 8) return setMsg({ pw: 'Use at least 8 characters.' })
    if (pw.next !== pw.confirm) return setMsg({ pw: 'The passwords do not match.' })
    const { error } = await updatePassword(pw.next)
    setMsg({ pw: error ? error.message : 'Password changed' })
    if (!error) setPw({ next: '', confirm: '' })
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <Card className="p-5 flex items-center gap-4">
        <button onClick={() => setPhoto(true)} className="relative group shrink-0" aria-label="Change profile photo" title="Change profile photo">
          <Avatar person={profile} size="lg" />
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center ring-2 ring-surface group-hover:bg-brand-hover">
            <Icon name="edit" size={12} />
          </span>
        </button>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-900 truncate">{profile.name}</p>
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          <p className="text-xs text-gray-400">{ROLE_LABELS[profile.role]}{projectNames ? `, ${projectNames}` : ''}{profile.can_assign_tasks ? '. Can assign tasks' : ''}</p>
        </div>
      </Card>

      <InstallCard />

      <ConnectedApps />

      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Appearance</p>
          <p className="text-xs text-gray-500">System follows your device setting.</p>
        </div>
        <div className="segmented" role="group" aria-label="Theme">
          {[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([k, l]) => (
            <button key={k} aria-pressed={pref === k} onClick={() => setTheme(k)}>{l}</button>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-gray-100">
        {[
          can('viewTeam') && { to: '/today', icon: 'today', title: 'My day', hint: 'Optional: log your own tasks for the day' },
          can('viewTeam') && { to: '/progress', icon: 'dashboard', title: 'My progress', hint: 'Your own week, month and calendar' },
          can('assignTasks') && { to: '/assigned', icon: 'assign', title: 'Tasks I assigned', hint: 'Follow up on work you handed out' },
          can('viewTeam') && { to: '/projects', icon: 'flag', title: 'Projects', hint: 'Create projects and choose their members' },
          { to: '/import', icon: 'upload', title: 'Import from Excel', hint: 'Bring in past work from a spreadsheet' },
        ].filter(Boolean).map(l => (
          <Link key={l.to} to={l.to} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50">
            <Icon name={l.icon} size={18} className="text-primary-700" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">{l.title}</span>
              <span className="block text-xs text-gray-500">{l.hint}</span>
            </span>
            <Icon name="right" size={16} className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
          </Link>
        ))}
      </Card>

      <Card className="p-5">
        <form onSubmit={saveName} className="space-y-3">
          <Input label="Display name" value={name} onChange={e => setName(e.target.value)} required />
          <div className="flex items-center justify-end gap-3">
            {msg.name && <span className="text-sm text-gray-500">{msg.name}</span>}
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="px-5 pt-4 pb-2">
          <p className="text-sm font-semibold text-gray-900">Notifications</p>
          <p className="text-xs text-gray-500">Everything appears under the bell in the app. Only the important ones are also emailed.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {NOTIFICATIONS
            .filter(n => (!n.tracked || isTracked(profile)) && (!n.reviewers || can('viewCompany')))
            .map(n => (
              <div key={n.key} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-gray-50/60">
                <span className="text-sm text-gray-700">{n.label}</span>
                {n.email ? (
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">Email</span>
                    <Switch checked={prefs[n.key] ?? true} onChange={() => togglePref(n.key)} label={`Email: ${n.label}`} />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 shrink-0"><Icon name="bell" size={13} /> In app only</span>
                )}
              </div>
            ))}
        </div>
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
      {photo && <AvatarEditor onClose={() => setPhoto(false)} />}
    </div>
  )
}
