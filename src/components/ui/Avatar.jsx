import { getInitials } from '../../utils/initials'

const SIZES = { xs: 'w-6 h-6 text-[9px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }

export default function Avatar({ person, size = 'sm', className = '' }) {
  const initials = person?.avatar_initials || getInitials(person?.name ?? '?')
  return (
    <div className={`${SIZES[size]} rounded-full bg-primary-600 text-white font-bold flex items-center justify-center shrink-0 ${className}`}>
      {initials}
    </div>
  )
}
