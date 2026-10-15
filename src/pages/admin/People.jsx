import { useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePeople, usePendingApprovals, useUpdatePerson, useInviteUser } from '../../hooks/usePeople'
import { useProjects, projectsOf } from '../../hooks/useProjects'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { ROLE_LABELS, assignableRoles } from '../../lib/permissions'
import { formatDisplay } from '../../utils/dates'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Sheet from '../../components/ui/Sheet'
import Icon from '../../components/ui/Icon'

const INHERENT_ASSIGN = ['manager', 'admin']

function PendingRow({ person, projects, roles }) {
  const update = useUpdatePerson()
  const [role, setRole] = useState('employee')
  const [project, setProject] = useState('')

  return (
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar person={person} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{person.name}</p>
          <p className="text-xs text-gray-500 truncate">{person.email} · requested {formatDisplay(person.created_at.slice(0, 10))}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <select className="field !py-1.5 sm:!w-36" value={role} onChange={e => setRole(e.target.value)} aria-label="Role">
          {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        {projects.length > 0 && (
          <select className="field !py-1.5 sm:!w-40" value={project} onChange={e => setProject(e.target.value)} aria-label="Project">
            <option value="">No project yet</option>
            {projects.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" loading={update.isPending}
          onClick={async () => {
            await update.mutateAsync({ id: person.id, is_approved: true, role })
            if (project) await supabase.from('project_members').insert({ project_id: project, user_id: person.id })
            toast(`${person.name} approved`)
          }}>Approve</Button>
        <Button size="sm" variant="outline" className="text-red-600"
          onClick={() => confirm(`Reject ${person.name}?`) && update.mutate({ id: person.id, is_active: false })}>Reject</Button>
      </div>
    </div>
  )
}

function PersonEditor({ person, projects, people, onClose }) {
  const { profile, can } = useAuth()
  const update = useUpdatePerson()
  const roles = assignableRoles(profile)
  const isSelf = person.id === profile.id
  const lockedAdmin = person.role === 'admin' && !can('grantPermissions')
  const [form, setForm] = useState({
    name: person.name,
    role: person.role,
    manager_id: person.manager_id ?? '',
    can_assign_tasks: person.can_assign_tasks,
    is_active: person.is_active,
  })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setError('')
    try {
      await update.mutateAsync({
        id: person.id,
        name: form.name.trim(),
        role: form.role,
        manager_id: form.manager_id || null,
        ...(can('grantPermissions') ? { can_assign_tasks: form.can_assign_tasks } : {}),
        is_active: form.is_active,
      })
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Sheet open onClose={onClose} title={person.name}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={update.isPending} disabled={lockedAdmin}>Save</Button></>}>
      <div className="space-y-4">
        {lockedAdmin && <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">Only an admin can edit admin accounts.</p>}
        <p className="text-xs text-gray-500">{person.email}</p>
        <div>
          <label className="label" htmlFor="p-name">Name</label>
          <input id="p-name" className="field" value={form.name} onChange={e => set('name', e.target.value)} disabled={lockedAdmin} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="p-role">Role</label>
            <select id="p-role" className="field" value={form.role} onChange={e => set('role', e.target.value)} disabled={lockedAdmin || isSelf}>
              {[...new Set([...roles, form.role])].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className="label">Projects</span>
          <p className="text-sm text-gray-700">
            {projectsOf(projects, person.id).map(p => p.name).join(', ') || 'Not in any project'}
            <span className="text-gray-400"> · change on the Projects page</span>
          </p>
        </div>
        <div>
          <label className="label" htmlFor="p-mgr">Reports to</label>
          <select id="p-mgr" className="field" value={form.manager_id} onChange={e => set('manager_id', e.target.value)} disabled={lockedAdmin}>
            <option value="">Nobody</option>
            {people.filter(p => p.id !== person.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <label className={`flex items-start gap-3 rounded-md border p-3 ${can('grantPermissions') ? 'border-primary-200 bg-primary-50/40' : 'border-gray-100 opacity-60'}`}>
          <input type="checkbox" className="mt-1 w-4 h-4 accent-primary-600"
            checked={INHERENT_ASSIGN.includes(form.role) || form.can_assign_tasks}
            disabled={!can('grantPermissions') || INHERENT_ASSIGN.includes(form.role)}
            onChange={e => set('can_assign_tasks', e.target.checked)} />
          <span>
            <span className="block text-sm font-medium text-gray-900">Can assign & edit tasks for others</span>
            <span className="block text-xs text-gray-500">
              {INHERENT_ASSIGN.includes(form.role)
                ? `${ROLE_LABELS[form.role]}s always have this.`
                : 'Lets this person (for example a BA or project lead) assign tasks to anyone and see team reports.'}
              {!can('grantPermissions') && ' Only an admin can change this.'}
            </span>
          </span>
        </label>

        {!isSelf && (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="w-4 h-4 accent-primary-600" checked={form.is_active} disabled={lockedAdmin}
              onChange={e => set('is_active', e.target.checked)} />
            <span className="text-sm text-gray-700">Active (unticking removes access and hides them from stats)</span>
          </label>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  )
}

// The sign in details to hand over, shown once after creating the account.
function Credentials({ email, password }) {
  const [copied, setCopied] = useState(false)
  const text = `StrideLog sign in\n${window.location.origin}/login\nEmail: ${email}\nTemporary password: ${password}\nYou will be asked to choose your own password.`
  return (
    <div className="space-y-4 page-in">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center ring-1 ring-inset ring-emerald-200"><Icon name="check" size={16} /></span>
        <p className="text-sm font-semibold text-gray-900">Account created</p>
      </div>
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-xs text-gray-500">Email</span>
          <span className="text-sm font-medium text-gray-900 truncate">{email}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-xs text-gray-500">Temporary password</span>
          <span className="font-mono text-[15px] font-semibold tracking-wide text-gray-900 select-all">{password}</span>
        </div>
      </div>
      <Button variant="secondary" className="w-full" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }}>
        <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copied' : 'Copy sign in details'}
      </Button>
      <p className="text-xs text-gray-500 leading-relaxed">
        Share these privately (in person or a direct message). This password is shown only once. At first sign in they must
        choose their own password. If it is lost, add them again from a new email or reset it from the sign in page.
      </p>
    </div>
  )
}

function InviteSheet({ projects, roles, onClose }) {
  const invite = useInviteUser()
  const [form, setForm] = useState({ email: '', name: '', role: 'employee', project_id: '', method: 'password' })
  const [done, setDone] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const byEmail = form.method === 'email'

  async function send(e) {
    e?.preventDefault()
    try {
      setDone(await invite.mutateAsync({ ...form, project_id: form.project_id || null }))
    } catch { /* shown below */ }
  }

  return (
    <Sheet open onClose={onClose} title="Add a person"
      footer={done ? <Button onClick={onClose}>Done</Button> : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={send} loading={invite.isPending}>{byEmail ? 'Send invite' : 'Create account'}</Button></>}>
      {done?.temp_password ? (
        <Credentials email={done.email} password={done.temp_password} />
      ) : done ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-700">Invitation sent to <strong>{form.email}</strong>. They'll set a password from the email and can start right away.</p>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <div className="segmented w-full grid grid-cols-2" role="group" aria-label="How they get access">
            <button type="button" aria-pressed={!byEmail} onClick={() => set('method', 'password')}>Temporary password</button>
            <button type="button" aria-pressed={byEmail} onClick={() => set('method', 'email')}>Email invite</button>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            {byEmail ? 'They get an email with a link to set their password. Needs working email.'
              : 'You get a temporary password to hand over. They choose their own at first sign in. No email needed.'}
          </p>
          <div>
            <label className="label" htmlFor="i-email">Work email</label>
            <input id="i-email" type="email" required className="field" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="i-name">Full name</label>
            <input id="i-name" required className="field" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="i-role">Role</label>
              <select id="i-role" className="field" value={form.role} onChange={e => set('role', e.target.value)}>
                {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="i-project">Project</label>
              <select id="i-project" className="field" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                <option value="">None yet</option>
                {projects.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {invite.isError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{invite.error.message}</p>}
          <button type="submit" className="hidden" />
        </form>
      )}
    </Sheet>
  )
}

export default function People() {
  const { profile } = useAuth()
  const { data: pending = [] } = usePendingApprovals()
  const { data: people = [], isLoading } = usePeople({ includeInactive: true })
  const { data: projects = [] } = useProjects()
  const roles = assignableRoles(profile)
  const [chosenTab, setTab] = useState(null)
  const tab = chosenTab ?? (pending.length ? 'pending' : 'people')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [inviting, setInviting] = useState(false)

  const filtered = useMemo(
    () => people.filter(p => `${p.name} ${p.email ?? ''}`.toLowerCase().includes(search.toLowerCase())),
    [people, search]
  )

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-surface border border-gray-100 rounded-md p-1">
          <button onClick={() => setTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'pending' ? 'bg-primary-600 text-white' : 'text-gray-600'}`}>
            Pending{pending.length > 0 && <span className="ml-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{pending.length}</span>}
          </button>
          <button onClick={() => setTab('people')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'people' ? 'bg-primary-600 text-white' : 'text-gray-600'}`}>People</button>
        </div>
        <div className="flex-1" />
        <Button onClick={() => setInviting(true)} aria-label="Add a person"><Icon name="plus" size={16} /><span className="hidden sm:inline">Add person</span></Button>
      </div>

      {tab === 'pending' ? (
        pending.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-gray-400">No one is waiting for approval.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-gray-50">
            {pending.map(p => <PendingRow key={p.id} person={p} projects={projects} roles={roles} />)}
          </Card>
        )
      ) : (
        <>
          <input type="search" className="field" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} />
          <Card className="divide-y divide-gray-50">
            {isLoading && <div className="h-24 skeleton" />}
            {filtered.map(p => (
              <button key={p.id} onClick={() => setEditing(p)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                <Avatar person={p} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${p.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">{p.email}{projectsOf(projects, p.id).length ? ` · ${projectsOf(projects, p.id).map(x => x.name).join(', ')}` : ''}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1">
                  {p.can_assign_tasks && !INHERENT_ASSIGN.includes(p.role) && <Badge variant="info">Can assign</Badge>}
                  <Badge variant={p.role === 'admin' ? 'admin' : 'pending'}>{ROLE_LABELS[p.role]}</Badge>
                </div>
              </button>
            ))}
          </Card>
        </>
      )}

      {editing && <PersonEditor person={editing} projects={projects} people={people.filter(p => p.is_active)} onClose={() => setEditing(null)} />}
      {inviting && <InviteSheet projects={projects} roles={roles} onClose={() => setInviting(false)} />}
    </div>
  )
}
