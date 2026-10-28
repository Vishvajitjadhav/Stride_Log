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
import Select from '../components/ui/Select'
import RailLayout, { FilterPanel, RailField, RailChoices, RailSearch } from '../components/layout/RailLayout'
import { useFacts } from '../hooks/useAnalytics'
import { presetRange } from '../utils/dates'

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
                    <Select className="field !h-8 !py-0 !w-28 !text-xs" value={role} onChange={e => setRole(p.id, e.target.value)} aria-label="Role in project">
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                    </Select>
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

const SORTS = [
  { key: 'name', label: 'Name' },
  { key: 'done', label: 'Most done' },
  { key: 'open', label: 'Most open work' },
  { key: 'people', label: 'Most people' },
]

// One project: its colour, this month's progress, who runs it and who is in it.
function ProjectCard({ p, s, byId, canManage, onEdit, onArchive }) {
  const managers = p.members.filter(m => m.role === 'manager').map(m => byId[m.user_id]?.name).filter(Boolean)
  const members = p.members.map(m => byId[m.user_id]).filter(Boolean)
  const pct = s.planned ? Math.round((s.done / s.planned) * 100) : 0
  return (
    <Card className="p-5 flex flex-col card-hover !border-t-4" style={{ borderTopColor: p.color }}>
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <Link to={`/reports?project=${p.id}&preset=this_month`} className="text-[15px] font-semibold text-gray-900 truncate block hover:text-primary-700 transition-colors">{p.name}</Link>
          {p.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>}
        </div>
        {!p.is_active && <Badge variant="off">Archived</Badge>}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-gray-600"><span className="text-lg font-semibold text-gray-900 tabular-nums">{s.done}</span> of {s.planned} done this month</span>
          <span className={`text-xs font-semibold tabular-nums ${!s.planned ? 'text-gray-400' : pct >= 80 ? 'text-mint-700' : pct >= 50 ? 'text-amber-800' : 'text-red-700'}`}>{s.planned ? `${pct}%` : 'No tasks'}</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: p.color }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {s.open > 0 && <span className="rounded-full px-2 py-0.5 bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">{s.open} open</span>}
          {s.blocked > 0 && <span className="rounded-full px-2 py-0.5 bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">{s.blocked} blocked</span>}
          {s.active > 0 && <span className="rounded-full px-2 py-0.5 bg-mint-50 text-mint-700 ring-1 ring-inset ring-mint-200">{s.active} worked on it</span>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex -space-x-1.5">
          {members.slice(0, 6).map(m => <Avatar key={m.id} person={m} size="xs" className="ring-2 ring-surface" />)}
          {members.length > 6 && <span className="w-6 h-6 rounded-full bg-gray-100 text-[10px] text-gray-600 flex items-center justify-center ring-2 ring-surface">+{members.length - 6}</span>}
        </div>
        <span className="text-xs text-gray-500 truncate">{managers.length ? `Run by ${managers.join(', ')}` : 'No manager set'}</span>
      </div>

      <div className="mt-auto pt-4 flex items-center gap-3 text-sm border-t border-gray-100">
        <Link to={`/reports?project=${p.id}&preset=this_month`} className="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-800 transition-colors">View report<Icon name="right" size={14} /></Link>
        <div className="flex-1" />
        {canManage && (
          <>
            <button onClick={onArchive} className="text-gray-500 hover:text-gray-900 transition-colors">{p.is_active ? 'Archive' : 'Restore'}</button>
            <button onClick={onEdit} className="font-medium text-gray-700 hover:text-gray-900 transition-colors">Edit</button>
          </>
        )}
      </div>
    </Card>
  )
}

export default function Projects() {
  const { can } = useAuth()
  const canManage = can('manageProjects')
  const [archived, setArchived] = useState(false)
  const [sort, setSort] = useState('name')
  const [member, setMember] = useState('all')
  const [search, setSearch] = useState('')
  const { data: projects = [], isLoading } = useProjects({ includeInactive: true })
  const { data: people = [] } = usePeople()
  const { setActive } = useProjectMutations()
  const [editing, setEditing] = useState(null)   // project | 'new' | null
  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])

  // This month's work per project, from the same facts the reports use.
  const month = presetRange('this_month')
  const { data: facts } = useFacts({ from: month.from, to: month.to })
  const stats = useMemo(() => {
    const out = {}
    for (const t of facts?.tasks ?? []) {
      if (!t.project_id) continue
      const s = out[t.project_id] ??= { planned: 0, done: 0, open: 0, blocked: 0, people: new Set() }
      s.planned++
      if (t.status === 'done') s.done++
      else s.open++
      if (t.status === 'blocked') s.blocked++
      s.people.add(t.user_id)
    }
    return out
  }, [facts])
  const statsOf = id => {
    const s = stats[id]
    return s ? { ...s, active: s.people.size } : { planned: 0, done: 0, open: 0, blocked: 0, active: 0 }
  }

  const q = search.trim().toLowerCase()
  const visible = projects
    .filter(p => p.is_active !== archived)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    .filter(p => member === 'all' || p.members.some(m => m.user_id === member))
    .sort((a, b) => {
      const x = statsOf(a.id), y = statsOf(b.id)
      if (sort === 'done') return y.done - x.done || a.name.localeCompare(b.name)
      if (sort === 'open') return y.open - x.open || a.name.localeCompare(b.name)
      if (sort === 'people') return b.members.length - a.members.length || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })
  const counts = { active: projects.filter(p => p.is_active).length, archived: projects.filter(p => !p.is_active).length }
  const active = Number(member !== 'all') + Number(Boolean(q)) + Number(sort !== 'name')
  const totals = projects.filter(p => p.is_active).reduce((t, p) => { const s = statsOf(p.id); return { done: t.done + s.done, open: t.open + s.open } }, { done: 0, open: 0 })

  const rail = (
    <>
      {canManage && <Button className="w-full" onClick={() => setEditing('new')}><Icon name="plus" size={16} />New project</Button>}
      <FilterPanel title="Projects" icon="flag" active={active} onClear={() => { setMember('all'); setSearch(''); setSort('name') }}>
        <RailField label="Show">
          <RailChoices label="Show" value={archived ? 'archived' : 'active'} onChange={k => setArchived(k === 'archived')}
            options={[{ key: 'active', label: 'Active', count: counts.active }, { key: 'archived', label: 'Archived', count: counts.archived }]} />
        </RailField>
        <RailField label="Sort by"><RailChoices label="Sort by" value={sort} onChange={setSort} options={SORTS} /></RailField>
        <RailField label="Has member">
          <Select aria-label="Has member" className={`field !h-9 !py-0 ${member !== 'all' ? '!bg-primary-600 !text-white !border-primary-600 [&_svg]:!text-white/80' : ''}`} value={member} onChange={e => setMember(e.target.value)}>
            <option value="all">Anyone</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </RailField>
        <RailField label="Project"><RailSearch value={search} onChange={setSearch} placeholder="Search projects" label="Search projects" /></RailField>
      </FilterPanel>
      <Card className="p-4">
        <p className="text-sm font-semibold text-gray-900">This month</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-mint-50 ring-1 ring-inset ring-mint-200 px-3 py-2"><p className="text-[11px] text-mint-700">Done</p><p className="text-lg font-semibold text-mint-700 tabular-nums">{totals.done}</p></div>
          <div className="rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 px-3 py-2"><p className="text-[11px] text-amber-800">Open</p><p className="text-lg font-semibold text-amber-800 tabular-nums">{totals.open}</p></div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Across {counts.active} active {counts.active === 1 ? 'project' : 'projects'}.</p>
      </Card>
    </>
  )

  return (
    <RailLayout rail={rail} active={active} summary={archived ? 'Archived' : 'Active'}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Projects</h2>
        <p className="text-xs text-gray-500">Group people by the work they do. One person can be in several projects. Click a name for its report.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <Card key={i} className="h-56 skeleton" />)}</div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-600">{q || member !== 'all' ? 'No projects match these filters.' : archived ? 'No archived projects.' : 'No projects yet.'}</p>
          {!archived && !q && member === 'all' && canManage && <Button className="mt-4" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Create the first project</Button>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 @[96rem]:grid-cols-4 gap-4 stagger">
          {visible.map((p, i) => (
            <div key={p.id} style={{ '--i': Math.min(i, 12) }} className="grid">
              <ProjectCard p={p} s={statsOf(p.id)} byId={byId} canManage={canManage} onEdit={() => setEditing(p)}
                onArchive={() => setActive.mutate({ id: p.id, is_active: !p.is_active }, { onSuccess: () => toast(p.is_active ? `${p.name} archived` : `${p.name} restored`) })} />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProjectEditor key={editing === 'new' ? 'new' : editing.id} project={editing === 'new' ? null : editing}
          people={people} onClose={() => setEditing(null)} />
      )}
    </RailLayout>
  )
}
