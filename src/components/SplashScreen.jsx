// Animated splash: the three log lines draw in one after another, the gold
// checkpoint pops in, then the wordmark rises. Pure CSS, no extra assets.
export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-center" role="status" aria-label="Loading StrideLog">
      <div className="relative">
        <span className="absolute inset-0 rounded-[22%] bg-[#1d3254] opacity-20 animate-[sl-ring_1.8s_ease-out_infinite]" />
        <svg width="76" height="76" viewBox="0 0 512 512" className="relative drop-shadow-lg">
          <rect width="512" height="512" rx="112" fill="#1d3254" />
          <g stroke="#fff" strokeWidth="44" strokeLinecap="round" fill="none">
            <path d="M128 348 H232" strokeOpacity="0.5" className="sl-line" style={{ animationDelay: '0ms' }} />
            <path d="M196 264 H300" strokeOpacity="0.78" className="sl-line" style={{ animationDelay: '160ms' }} />
            <path d="M264 180 H316" className="sl-line" style={{ animationDelay: '320ms' }} />
          </g>
          <circle cx="380" cy="180" r="34" fill="#c9a43f" className="sl-dot" />
        </svg>
      </div>
      <p className="mt-6 text-2xl tracking-tight text-gray-900 sl-word">
        <span className="font-bold">Stride</span><span className="font-normal">Log</span>
      </p>
      <p className="mt-1 text-xs tracking-[0.2em] uppercase text-gray-500 sl-word" style={{ animationDelay: '650ms' }}>Daily work, clearly logged</p>
      <style>{`
        .sl-line { stroke-dasharray: 120; stroke-dashoffset: 120; animation: sl-draw .45s cubic-bezier(.4,0,.2,1) forwards; }
        .sl-dot  { transform-origin: 380px 180px; transform: scale(0); animation: sl-pop .4s cubic-bezier(.3,1.6,.5,1) .6s forwards; }
        .sl-word { opacity: 0; transform: translateY(6px); animation: sl-rise .5s ease-out .55s forwards; }
        @keyframes sl-draw { to { stroke-dashoffset: 0 } }
        @keyframes sl-pop  { to { transform: scale(1) } }
        @keyframes sl-rise { to { opacity: 1; transform: none } }
        @keyframes sl-ring { 0% { transform: scale(1); opacity: .25 } 100% { transform: scale(1.6); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) {
          .sl-line, .sl-dot, .sl-word { animation: none; stroke-dashoffset: 0; transform: none; opacity: 1 }
        }
      `}</style>
    </div>
  )
}
