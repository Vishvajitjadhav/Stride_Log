import { useState } from 'react'
import { getInitials } from '../../utils/initials'

const SIZES = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-28 h-28 text-3xl',
}

// Profile photo when there is one, otherwise initials.
export default function Avatar({ person, size = 'sm', className = '' }) {
  const [broken, setBroken] = useState(false)
  const initials = person?.avatar_initials || getInitials(person?.name ?? '?')
  const base = `${SIZES[size]} rounded-full shrink-0 ${className}`

  if (person?.avatar_url && !broken) {
    return <img src={person.avatar_url} alt="" loading="lazy" onError={() => setBroken(true)} className={`${base} object-cover bg-gray-100`} />
  }
  return <div className={`${base} bg-primary-100 text-primary-800 font-semibold flex items-center justify-center`}>{initials}</div>
}
