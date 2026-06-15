import { useState } from 'react'
import { useTeam, useAllCategories, useCategoryMutations, useDeactivateMember } from '../../hooks/useTeam'
import { useAuth } from '../../contexts/AuthContext'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'

const PRESET_COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

export default function Settings() {
  const { isAdmin } = useAuth()
  // Managers can manage categories but not member accounts.
  const tabs = isAdmin ? ['members', 'categories'] : ['categories']
  const [tab, setTab] = useState(isAdmin ? 'members' : 'categories')
  const { data: members = [] } = useTeam()
  const { data: categories = [] } = useAllCategories()
  const { addCategory, toggleCategory } = useCategoryMutations()
  const deactivateMember = useDeactivateMember()

  const [newCat, setNewCat] = useState({ name: '', color: '#7c3aed' })
  const [catError, setCatError] = useState('')

  async function handleAddCategory() {
    if (!newCat.name.trim()) { setCatError('Name required'); return }
    setCatError('')
    await addCategory.mutateAsync(newCat)
    setNewCat({ name: '', color: '#7c3aed' })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >{t}</button>
        ))}
      </div>

      {tab === 'members' && isAdmin && (
        <Card className="overflow-hidden">
          <div className="p-4 bg-amber-50 rounded-t-xl">
            <p className="text-xs text-amber-800">
              To add a new member: go to <strong>Supabase Dashboard → Authentication → Users → Invite user</strong>.<br />
              Then in SQL Editor set their role (<code className="bg-amber-100 px-1 rounded text-[11px]">'employee'</code>, <code className="bg-amber-100 px-1 rounded text-[11px]">'manager'</code> or <code className="bg-amber-100 px-1 rounded text-[11px]">'admin'</code>):{' '}
              <code className="bg-amber-100 px-1 rounded text-[11px]">UPDATE profiles SET role = 'manager' WHERE id = '&lt;user-uuid&gt;';</code>
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{m.avatar_initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.is_active ? 'submitted' : 'missing'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>
                  {m.is_active && m.role !== 'admin' && (
                    <button
                      onClick={() => { if (confirm(`Deactivate ${m.name}?`)) deactivateMember.mutate(m.id) }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'categories' && (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Add Category</p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input label="Name" placeholder="e.g. Research" value={newCat.name}
                  onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))} error={catError} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewCat(n => ({ ...n, color: c }))}
                      className={`w-6 h-6 rounded-full transition-transform ${newCat.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <button onClick={handleAddCategory} disabled={addCategory.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                Add
              </button>
            </div>
          </Card>

          <Card className="divide-y divide-gray-50">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                  <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                  {!cat.is_active && <Badge variant="missing">Inactive</Badge>}
                </div>
                <button
                  onClick={() => toggleCategory.mutate({ id: cat.id, is_active: !cat.is_active })}
                  className={`text-xs font-medium ${cat.is_active ? 'text-gray-400 hover:text-red-500' : 'text-primary-600 hover:text-primary-700'}`}
                >
                  {cat.is_active ? 'Deactivate' : 'Restore'}
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
