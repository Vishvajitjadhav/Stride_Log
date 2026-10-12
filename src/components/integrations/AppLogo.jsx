// Small marks for the connected apps (simple shapes in each app's colours).
export default function AppLogo({ app, size = 36 }) {
  const box = 'shrink-0 rounded-lg flex items-center justify-center shadow-sm ring-1 ring-black/5'
  if (app === 'teams') {
    return (
      <span className={`${box} bg-[#5059c9]`} style={{ width: size, height: size }} aria-hidden="true">
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20">
          <rect x="2" y="4" width="11" height="12" rx="2" fill="#fff" />
          <path d="M5 7.5h5M7.5 7.5v6" stroke="#5059c9" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="6" r="2" fill="#c5c9f6" />
          <rect x="14" y="9" width="4.5" height="6" rx="2" fill="#c5c9f6" />
        </svg>
      </span>
    )
  }
  return (
    <span className={`${box} bg-[#0c66e4]`} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20">
        <path d="M10 2.5 17.5 10 10 17.5 2.5 10Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 7 13 10 10 13 7 10Z" fill="#fff" />
      </svg>
    </span>
  )
}
