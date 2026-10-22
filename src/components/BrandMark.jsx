import { useOrgSettings } from '../hooks/useOrg'
import { LogoMark, Wordmark } from './Logo'

// Company logo + name when configured, otherwise the StrideLog mark.
export default function BrandMark({ compact = false, inverted = false }) {
  const { data: org } = useOrgSettings()
  const custom = org?.logo_url
  const company = org?.company_name && org.company_name !== 'StrideLog' ? org.company_name : null
  const size = compact ? 28 : 32

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {custom
        ? <img src={custom} alt="" style={{ width: size, height: size }} className="rounded-md object-contain bg-surface" />
        : <LogoMark size={size} />}
      {!compact && (company
        ? <span className={`font-semibold truncate ${inverted ? 'text-white' : 'text-gray-900'}`}>{company}</span>
        : <Wordmark inverted={inverted} />)}
    </div>
  )
}
