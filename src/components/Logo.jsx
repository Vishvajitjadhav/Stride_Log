import { useId } from 'react'

// StrideLog mark: three log lines rising like a stride, ending at a mint
// checkpoint ("progress, logged"). Keep in sync with public/logo.svg.
export function LogoMark({ size = 32, className = '' }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c7ff7" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill={`url(#${id})`} />
      <g stroke="#fff" strokeWidth="44" strokeLinecap="round" fill="none">
        <path d="M128 348 H232" strokeOpacity="0.55" />
        <path d="M196 264 H300" strokeOpacity="0.8" />
        <path d="M264 180 H316" />
      </g>
      <circle cx="380" cy="180" r="36" fill="#34d3a6" />
    </svg>
  )
}

export function Wordmark({ inverted = false, className = '' }) {
  return (
    <span className={`text-[17px] tracking-tight ${inverted ? 'text-white' : 'text-gray-900'} ${className}`}>
      <span className="font-bold">Stride</span><span className="font-normal text-primary-600">Log</span>
    </span>
  )
}
