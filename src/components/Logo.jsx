// StrideLog mark: three log lines rising like a stride, ending at a gold
// checkpoint ("progress, logged"). Keep in sync with public/logo.svg.
// onDark: lighter tile so the mark stays visible on navy backgrounds.
export function LogoMark({ size = 32, className = '', onDark = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill={onDark ? '#2f4e7e' : '#1d3254'} />
      <g stroke="#fff" strokeWidth="44" strokeLinecap="round" fill="none">
        <path d="M128 348 H232" strokeOpacity="0.5" />
        <path d="M196 264 H300" strokeOpacity="0.78" />
        <path d="M264 180 H316" />
      </g>
      <circle cx="380" cy="180" r="34" fill="#c9a43f" />
    </svg>
  )
}

export function Wordmark({ inverted = false, className = '' }) {
  return (
    <span className={`text-[17px] tracking-tight ${inverted ? 'text-white' : 'text-primary-900'} ${className}`}>
      <span className="font-bold">Stride</span><span className="font-normal">Log</span>
    </span>
  )
}
