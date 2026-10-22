import { useEffect, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Starts at `from` and flips to `to` one frame after mount, so CSS transitions run.
function useMounted() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return on
}

// A number that counts up to its value (eased), then stays put.
export function CountUp({ value, duration = 900 }) {
  const target = Number(value) || 0
  const [animate] = useState(() => !reduced())
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf
    let start
    const tick = t => {
      start ??= t
      const p = Math.min(1, (t - start) / duration)
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, target, duration])

  if (value == null || Number.isNaN(Number(value))) return value
  return animate ? shown : target
}

// Horizontal bar that fills from empty to `value` percent.
export function Meter({ value, className = '', barClassName = 'bg-gradient-to-r from-primary-500 to-mint-400' }) {
  const on = useMounted()
  return (
    <div className={`h-1.5 rounded-full bg-gray-100 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-1000 ease-out ${barClassName}`} style={{ width: `${on ? value ?? 0 : 0}%` }} />
    </div>
  )
}

// Circular score (0 to 100) that draws itself in, with the number in the middle.
export function ScoreRing({ value, size = 64, stroke = 6, label, className = '' }) {
  const on = useMounted()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const id = `ring-${size}-${stroke}`
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Score'} ${value ?? 'not available'} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-primary-500)" />
            <stop offset="1" stopColor="var(--color-mint-400)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-gray-100)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - pct / 100) : c}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-gray-900" style={{ fontSize: size * 0.28 }}>
        {value == null ? 'n/a' : <CountUp value={value} />}
      </span>
    </div>
  )
}
