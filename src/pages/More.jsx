import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePendingApprovals } from '../hooks/usePeople'
import { ROLE_LABELS } from '../lib/permissions'
import { visibleNav } from '../components/layout/nav'
import Card from '../components/ui/Card'
import Icon from '../components/ui/Icon'
import Avatar from '../components/ui/Avatar'
import InstallCard from '../components/InstallCard'

// Phone-only menu for everything that isn't in the bottom tab bar.
export default function More() {
  const { profile, can, signOut } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const items = visibleNav(can)
  const tabs = new Set(items.filter(i => i.tab).slice(0, 4).map(i => i.to))
  const rest = items.filter(i => !tabs.has(i.to))

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <NavLink to="/profile">
        <Card className="p-4 flex items-center gap-3">
          <Avatar person={profile} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{profile?.name}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[profile?.role]}</p>
          </div>
          <Icon name="right" className="text-gray-300" />
        </Card>
      </NavLink>

      <InstallCard />

      <Card className="divide-y divide-gray-50">
        {rest.map(i => (
          <NavLink key={i.to} to={i.to} className="flex items-center gap-3 px-4 py-3.5 text-gray-700 active:bg-gray-50">
            <Icon name={i.icon} className="text-primary-600" />
            <span className="flex-1 text-sm font-medium">{i.label}</span>
            {i.badge === 'pending' && pending.length > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{pending.length}</span>
            )}
            <Icon name="right" size={16} className="text-gray-300" />
          </NavLink>
        ))}
      </Card>

      <button onClick={signOut} className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600">
        <Icon name="logout" size={18} /> Sign out
      </button>
    </div>
  )
}
