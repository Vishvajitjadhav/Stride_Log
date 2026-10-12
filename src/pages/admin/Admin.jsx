import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingApprovals } from '../../hooks/usePeople'
import People from './People'
import { Categories, Holidays, Company } from './SettingsSections'
import Integrations from './Integrations'

// One place for administration; tabs depend on the role.
export default function Admin() {
  const { can } = useAuth()
  const { data: pending = [] } = usePendingApprovals({ enabled: can('managePeople') })
  const [params, setParams] = useSearchParams()

  const tabs = [
    can('managePeople') && { key: 'people', label: 'People', badge: pending.length, el: <People /> },
    can('manageCategories') && { key: 'categories', label: 'Categories', el: <Categories /> },
    can('manageHolidays') && { key: 'holidays', label: 'Holidays', el: <Holidays /> },
    can('manageCompany') && { key: 'company', label: 'Company', el: <Company /> },
    can('manageCompany') && { key: 'integrations', label: 'Integrations', el: <Integrations /> },
  ].filter(Boolean)
  const current = tabs.find(t => t.key === params.get('tab')) ?? tabs[0]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="page-title">{can('managePeople') ? 'Administration' : 'Settings'}</h2>
        <p className="page-subtitle">
          {can('managePeople') ? 'People, access and company settings.' : 'Task categories used across the company.'}
        </p>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-6 border-b border-gray-200 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setParams({ tab: t.key }, { replace: true })}
              className={`-mb-px pb-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                current.key === t.key ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {t.label}
              {t.badge > 0 && <span className="ml-1.5 text-[10px] font-semibold bg-accent-500 text-primary-900 rounded px-1.5 py-0.5">{t.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {current?.el}
    </div>
  )
}
