import { useOrgSettings } from '../hooks/useOrg'

// Company logo + name from org settings, falling back to the StrideLog mark.
export default function BrandMark({ compact = false, inverted = false }) {
  const { data: org } = useOrgSettings()
  const name = org?.company_name || 'StrideLog'

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {org?.logo_url ? (
        <img src={org.logo_url} alt="" className={`${compact ? 'h-7 w-7' : 'h-8 w-8'} rounded-lg object-contain bg-white`} />
      ) : (
        <div className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} ${inverted ? 'bg-white/20 backdrop-blur-sm' : 'bg-primary-600'} rounded-lg flex items-center justify-center shrink-0`}>
          <span className="text-white font-black text-sm">{name[0]}</span>
        </div>
      )}
      {!compact && <span className={`font-bold truncate ${inverted ? 'text-white text-lg' : 'text-gray-900'}`}>{name}</span>}
    </div>
  )
}
