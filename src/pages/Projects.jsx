import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProjects, useProjectMutations } from '../hooks/useProjects'
import { usePeople } from '../hooks/usePeople'
import { ROLE_LABELS } from '../lib/permissions'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Sheet from '../components/ui/Sheet'
import Icon from '../components/ui/Icon'
import { toast } from '../lib/toast'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#14b88c', '#06b6d4', '#3b82f6', '#64748b']

function ProjectEditor({ project, people, onClose }) {
  const { save } = useProjectMutations()
  const [form, setForm] = useState(() => ({
    name: project?.name ?? '',
    description: project?.description ?? '',
    color: project?.color ?? COLORS[0],
    members: Object.fromEntries((project?.members ?? []).map(m => [m.user_id, m.role])),
  }))
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = p => setForm(f => {
    const members = { ...f.members }
    if (members[p.id]) delete members[p.id]
    else members[p.id] = ['manager', 'hr', 'admin'].includes(p.role) ? 'manager' : 'member'
    return { ...f, members }
  })
  const setRole = (id, role) => setForm(f => ({ ...f, members: { ...f.members, [id]: role } }))

  const list = people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const selected = Object.keys(form.members).length

  async function submit(e) {
    e?.preventDefault()
    if (!form.name.trim()) return setError('Enter a project name.')
    setError('')
    try {
      await save.mutateAsync({
        id: project?.id, name: form.name, description: form.description, color: form.color,
        members: Object.entries(form.members).map(([user_id, role]) => ({ user_id, role })),
      })
      toast(project ? 'Project saved' : `Project ${form.name.trim()} created`)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Sheet open onClose={onClose} title={project ? 'Edit project' : 'New project'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save project</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="p-name">Project name</label>
          <input id="p-name" className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="For example, Mobile app" autoFocus={!project} />
        </div>
        <div>
          <label className="label" htmlFor="p-desc">Description <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="p-desc" className="field" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Client, goal or scope" />
        </div>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button type="button" key={c} onClick={() => set('color', c)} aria-label={`Colour ${c}`}
                className={`w-7 h-7 rounded-md transition ${form.color === c ? 'ring-2 ring-offset-2 ring-primary-600 ring-offset-surface' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label !mb-0">People ({selected} selected)</span>
            <span className="text-xs text-gray-500">Project managers can follow its report</span>
          </div>
          <input type="search" className="field mb-2" placeholder="Search people" value={search} onChange={e => setSearch(e.target.value)} />
          <ul className="max-h-72 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {list.map(p => {
              const role = form.members[p.id]
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={Boolean(role)} onChange={() => toggle(p)} aria-label={`Include ${p.name}`} />
                  <Avatar person={p} size="xs" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-900 truncate">{p.name}</span>
                    <span className="block text-xs text-gray-500">{ROLE_LABELS[p.role]}</span>
                  </span>
                  {role && (
                    <select className="field !h-8 !py-0 !w-28 !text-xs" value={role} onChange={e => setRole(p.id, e.target.value)} aria-label="Role in project">
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}

export default function Projects() {
  const { can } = useAuth()
  const canManage = can('manageProjects')
  const [archived, setArchived] = useState(false)
  const { data: projects = [], isLoading } = useProjects({ includeInactive: true })
  const { data: people = [] } = usePeople()
  const { setActive } = useProjectMutations()
  const [editing, setEditing] = useState(null)   // project | 'new' | null
  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])
  const visible = projects.filter(p => p.is_active !== archived)

  return (
    <div className="max-w-6xl 2xl:max-w-7xl 3xl:max-w-[88rem] mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Projects</h2>
          <p className="page-subtitle">Group people by the work they do. One person can be in several projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="segmented" role="group" aria-label="Show">
            <button aria-pressed={!archived} onClick={() => setArchived(false)}>Active</button>
            <button aria-pressed={archived} onClick={() => setArchived(true)}>Archived</button>
          </div>
          {canManage && <Button onClick={() => setEditing('new')}><Icon name="plus" size={16} />New project</Button>}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map(i => <Card key={i} className="h-40 skeleton" />)}</div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-600">{archived ? 'No archived projects.' : 'No projects yet.'}</p>
          {!archived && canManage && <Button className="mt-4" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Create the first project</Button>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(p => {
            const managers = p.members.filter(m => m.role === 'manager').map(m => byId[m.user_id]?.name).filter(Boolean)
            const members = p.members.map(m => byId[m.user_id]).filter(Boolean)
            return (
              <Card key={p.id} className="p-5 flex flex-col transition-[box-shadow,border-color] duration-200 hover:border-gray-300 hover:shadow-[0_10px_28px_-14px_rgb(15_23_42/.28)]">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 w-3 h-3 rounded-sm shrink-0" style={{ background: p.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-gray-900 truncate">{p.name}</p>
                    {p.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>}
                  </div>
                  {!p.is_active && <Badge variant="off">Archived</Badge>}
                </div>

                <p className="text-xs text-gray-500 mt-4">Managed by</p>
                <p className="text-sm text-gray-800">{managers.length ? managers.join(', ') : 'No manager set'}</p>

                <p className="text-xs text-gray-500 mt-3 mb-1.5">{members.length} {members.length === 1 ? 'person' : 'people'}</p>
                <div className="flex -space-x-1.5">
                  {members.slice(0, 7).map(m => <Avatar key={m.id} person={m} size="xs" className="ring-2 ring-surface" />)}
                  {members.length > 7 && <span className="w-6 h-6 rounded-full bg-gray-100 text-[10px] text-gray-600 flex items-center justify-center ring-2 ring-surface">+{members.length - 7}</span>}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3 text-sm">
                  <Link to={`/reports?project=${p.id}&preset=this_month`} className="font-medium text-primary-600 hover:text-primary-700">View report</Link>
                  <div className="flex-1" />
                  {canManage && (
                    <>
                      <button onClick={() => setActive.mutate({ id: p.id, is_active: !p.is_active }, { onSuccess: () => toast(p.is_active ? `${p.name} archived` : `${p.name} restored`) })} className="text-gray-500 hover:text-gray-900">
                        {p.is_active ? 'Archive' : 'Restore'}
                      </button>
                      <button onClick={() => setEditing(p)} className="font-medium text-gray-700 hover:text-gray-900">Edit</button>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <ProjectEditor key={editing === 'new' ? 'new' : editing.id} project={editing === 'new' ? null : editing}
          people={people} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
