import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCategories, useCategoryMutations } from '../../hooks/useCategories'
import { useTeams, useTeamMutations, useHolidays, useHolidayMutations, useOrgSettings, useUpdateOrg, useUploadLogo } from '../../hooks/useOrg'
import { usePeople } from '../../hooks/usePeople'
import { formatShort, todayISO } from '../../utils/dates'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'

const PRESET_COLORS = ['#7c3aed', '#ec4899', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ef4444', '#64748b']

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map(c => (
        <button type="button" key={c} onClick={() => onChange(c)} aria-label={c}
          className={`w-7 h-7 rounded-full transition-transform ${value === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : ''}`}
          style={{ background: c }} />
      ))}
    </div>
  )
}

function Categories() {
  const { data: categories = [] } = useCategories({ includeInactive: true })
  const { save } = useCategoryMutations()
  const [form, setForm] = useState({ name: '', color: '#7c3aed' })
  const [error, setError] = useState('')

  async function add(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name required')
    setError('')
    try {
      await save.mutateAsync({ name: form.name.trim(), color: form.color })
      setForm({ name: '', color: form.color })
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'That category already exists.' : err.message)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={add} className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Add category</p>
          <div className="flex gap-2">
            <input className="field flex-1" placeholder="e.g. Sprint Planning" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Button type="submit" loading={save.isPending}>Add</Button>
          </div>
          <ColorPicker value={form.color} onChange={color => setForm(f => ({ ...f, color }))} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Card>
      <Card className="divide-y divide-gray-50">
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
            <span className={`text-sm font-medium flex-1 ${c.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{c.name}</span>
            {!c.is_active && <Badge variant="draft">Hidden</Badge>}
            <button onClick={() => save.mutate({ id: c.id, is_active: !c.is_active })}
              className={`text-xs font-medium ${c.is_active ? 'text-gray-400 hover:text-red-500' : 'text-primary-600'}`}>
              {c.is_active ? 'Hide' : 'Restore'}
            </button>
          </div>
        ))}
      </Card>
      <p className="text-xs text-gray-400">Hidden categories stay on old tasks but can't be picked for new ones.</p>
    </div>
  )
}

function Teams() {
  const { data: teams = [] } = useTeams()
  const { data: people = [] } = usePeople()
  const { save, remove } = useTeamMutations()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const count = id => people.filter(p => p.team_id === id).length

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    try { await save.mutateAsync({ name: name.trim() }); setName('') } catch (err) { setError(err.message) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={add} className="flex gap-2">
          <input className="field flex-1" placeholder="New team, e.g. Mobile" value={name} onChange={e => setName(e.target.value)} />
          <Button type="submit" loading={save.isPending}>Add</Button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </Card>
      <Card className="divide-y divide-gray-50">
        {teams.length === 0 && <p className="text-sm text-gray-400 p-6 text-center">No teams yet.</p>}
        {teams.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t.name}</p>
              <p className="text-xs text-gray-400">{count(t.id)} people</p>
            </div>
            <select className="field !w-40 !py-1.5" value={t.lead_id ?? ''} onChange={e => save.mutate({ id: t.id, lead_id: e.target.value || null })} aria-label="Team lead">
              <option value="">No lead</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => confirm(`Delete team ${t.name}? Members keep their accounts.`) && remove.mutate(t.id)} className="p-2 text-gray-300 hover:text-red-500" aria-label="Delete team">
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </Card>
      <p className="text-xs text-gray-400">Put people into teams from Admin → People.</p>
    </div>
  )
}

function Holidays() {
  const { data } = useHolidays()
  const { add, remove } = useHolidayMutations()
  const [form, setForm] = useState({ date: todayISO(), name: '' })
  const year = new Date().getFullYear()
  const list = (data?.list ?? []).filter(h => h.date >= `${year - 1}-01-01`)

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    await add.mutateAsync({ date: form.date, name: form.name.trim() })
    setForm(f => ({ ...f, name: '' }))
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_auto] gap-2">
          <input type="date" className="field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          <input className="field" placeholder="e.g. Diwali" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Button type="submit" loading={add.isPending}>Add holiday</Button>
        </form>
      </Card>
      <Card className="divide-y divide-gray-50">
        {list.length === 0 && <p className="text-sm text-gray-400 p-6 text-center">No holidays added.</p>}
        {list.map(h => (
          <div key={h.date} className={`flex items-center gap-3 px-4 py-3 ${h.date < todayISO() ? 'opacity-50' : ''}`}>
            <span className="text-sm font-medium text-gray-900 w-28">{formatShort(h.date)}</span>
            <span className="text-sm text-gray-700 flex-1">{h.name}</span>
            <button onClick={() => remove.mutate(h.date)} className="p-2 text-gray-300 hover:text-red-500" aria-label="Remove holiday"><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </Card>
      <p className="text-xs text-gray-400">Holidays aren't counted as missed days. Anyone who logs work on a holiday gets an extra day ★.</p>
    </div>
  )
}

function Company() {
  const { data: org } = useOrgSettings()
  const update = useUpdateOrg()
  const upload = useUploadLogo()
  const [form, setForm] = useState(null)
  const f = form ?? org
  const [saved, setSaved] = useState(false)
  if (!f) return null
  const set = (k, v) => setForm({ ...f, [k]: v })

  async function save(e) {
    e.preventDefault()
    await update.mutateAsync({
      company_name: f.company_name, timezone: f.timezone, report_footer: f.report_footer, app_url: f.app_url,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card className="p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-900">Branding</p>
        <div className="flex items-center gap-4">
          {org.logo_url
            ? <img src={org.logo_url} alt="Company logo" className="w-16 h-16 rounded-xl object-contain border border-gray-100 bg-white" />
            : <div className="w-16 h-16 rounded-xl bg-primary-600 flex items-center justify-center text-white text-2xl font-black">{(org.company_name || 'S')[0]}</div>}
          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-primary-100">
              <Icon name="upload" size={16} /> {upload.isPending ? 'Uploading…' : 'Upload logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={e => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
            </label>
            <p className="text-xs text-gray-400">PNG or JPG, square, under 2 MB. Used in the app, PDF reports and emails.</p>
            {upload.isError && <p className="text-xs text-red-600">{upload.error.message}</p>}
            {org.logo_url && (
              <button type="button" onClick={() => update.mutate({ logo_url: null })} className="text-xs text-gray-400 hover:text-red-500">Remove logo</button>
            )}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="c-name">Company name</label>
          <input id="c-name" className="field" value={f.company_name} onChange={e => set('company_name', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="c-footer">Report footer</label>
          <input id="c-footer" className="field" value={f.report_footer} onChange={e => set('report_footer', e.target.value)} />
        </div>
      </Card>
      <Card className="p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-900">System</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-tz">Timezone</label>
            <input id="c-tz" className="field" value={f.timezone} onChange={e => set('timezone', e.target.value)} placeholder="Asia/Kolkata" />
          </div>
          <div>
            <label className="label" htmlFor="c-url">App URL (used in emails)</label>
            <input id="c-url" className="field" value={f.app_url} onChange={e => set('app_url', e.target.value)} placeholder="https://stridelog.yourcompany.com" />
          </div>
        </div>
      </Card>
      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
        <Button type="submit" loading={update.isPending}>Save settings</Button>
      </div>
    </form>
  )
}

export default function Settings() {
  const { can } = useAuth()
  const tabs = [
    can('manageCategories') && { key: 'categories', label: 'Categories', el: <Categories /> },
    can('manageTeams') && { key: 'teams', label: 'Teams', el: <Teams /> },
    can('manageHolidays') && { key: 'holidays', label: 'Holidays', el: <Holidays /> },
    can('manageCompany') && { key: 'company', label: 'Company', el: <Company /> },
  ].filter(Boolean)
  const [tab, setTab] = useState(tabs[0]?.key)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`chip ${tab === t.key ? 'chip-active' : ''}`}>{t.label}</button>)}
      </div>
      {tabs.find(t => t.key === tab)?.el}
    </div>
  )
}
