import { LogoMark } from '../Logo'
import AppLogo from '../integrations/AppLogo'

// The sign in page's "trailer": StrideLog working, in one view, with no
// paragraphs. Work moves across a board, the week's bars grow, the team's
// completion ring fills, growth draws itself, Jira and Teams keep syncing.
// Pure CSS and SVG (keyframes in index.css), so it costs nothing to load,
// and it holds still for people who prefer reduced motion.

const BARS = [38, 52, 46, 68, 74, 88]
const PEOPLE = [['AR', '#6366f1'], ['SK', '#14b88c'], ['LP', '#f59e0b'], ['NN', '#ec4899']]

function Tile({ className = '', children, style }) {
  return <div style={style} className={`trailer-tile rounded-2xl p-4 ${className}`}>{children}</div>
}

function Label({ icon, children }) {
  return <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{icon}{children}</p>
}

export default function ProductTrailer() {
  return (
    <div className="relative h-full w-full overflow-hidden trailer-bg">
      <div className="trailer-grid absolute inset-0" aria-hidden="true" />
      <div className="trailer-orb trailer-orb-a" aria-hidden="true" />
      <div className="trailer-orb trailer-orb-b" aria-hidden="true" />

      <div className="relative h-full flex flex-col justify-center gap-8 px-8 xl:px-14 py-10 max-w-[44rem] mx-auto" role="img"
        aria-label="StrideLog preview: tasks moving across a board, weekly progress growing, team completion and Jira and Teams syncing.">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <p className="text-2xl font-semibold text-white tracking-tight">Plan. Track. <span className="trailer-shine">Grow.</span></p>
            <p className="text-sm text-white/55">Your team's work, live in one place.</p>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3">
          {/* Board: a card travels To do, In progress, Done */}
          <Tile className="col-span-4">
            <Label>Board</Label>
            <div className="relative grid grid-cols-3 gap-2 mt-3 h-[7.5rem]">
              {[['To do', 'bg-white/30'], ['In progress', 'bg-amber-400'], ['Done', 'bg-mint-400']].map(([name, dot]) => (
                <div key={name} className="rounded-xl bg-white/[.04] ring-1 ring-inset ring-white/10 p-2 space-y-1.5">
                  <p className="flex items-center gap-1.5 text-[10px] text-white/60"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{name}</p>
                  <div className="h-5 rounded-md bg-white/10" />
                  <div className="h-5 rounded-md bg-white/[.07] w-4/5" />
                </div>
              ))}
              <div className="trailer-mover absolute top-[3.15rem] left-2 w-[calc(33.333%-1.1rem)] h-7 rounded-md bg-white text-[10px] font-medium text-gray-800 flex items-center gap-1.5 px-2 shadow-lg">
                <span className="trailer-mover-dot w-1.5 h-1.5 rounded-full" />Release v2
              </div>
            </div>
          </Tile>

          {/* Team completion ring */}
          <Tile className="col-span-2 flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-1">
            <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90" aria-hidden="true">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth="9" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="url(#ring)" strokeWidth="9" strokeLinecap="round" className="trailer-ring" />
              <defs><linearGradient id="ring" x1="0" x2="1"><stop offset="0" stopColor="#8b8ff7" /><stop offset="1" stopColor="#34d3a6" /></linearGradient></defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white tabular-nums">82%</span>
            </div>
            <Label>Done</Label>
          </Tile>

          {/* Weekly bars */}
          <Tile className="col-span-3">
            <Label>This week</Label>
            <div className="flex items-end gap-2 h-20 mt-3">
              {BARS.map((h, i) => (
                <span key={i} className="trailer-bar flex-1 rounded-t-md bg-gradient-to-t from-primary-500 to-[#a5a8fa]"
                  style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </Tile>

          {/* Growth line */}
          <Tile className="col-span-3">
            <div className="flex items-center justify-between">
              <Label>Growth</Label>
              <span className="text-xs font-semibold text-mint-400 flex items-center gap-1">▲ 24%</span>
            </div>
            <svg viewBox="0 0 160 70" className="w-full h-20 mt-2" aria-hidden="true">
              <path d="M2 62 C 30 58, 40 44, 62 46 S 98 30, 112 26 S 140 10, 158 6" fill="none" stroke="#34d3a6" strokeWidth="3" strokeLinecap="round" className="trailer-line" />
              <path d="M2 62 C 30 58, 40 44, 62 46 S 98 30, 112 26 S 140 10, 158 6 L158 70 L2 70Z" fill="url(#area)" className="trailer-area" />
              <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#34d3a6" stopOpacity=".35" /><stop offset="1" stopColor="#34d3a6" stopOpacity="0" /></linearGradient></defs>
            </svg>
          </Tile>

          {/* People active today */}
          <Tile className="col-span-3 flex items-center justify-between gap-3">
            <div>
              <Label>Active today</Label>
              <div className="flex -space-x-2 mt-2.5">
                {PEOPLE.map(([initials, color], i) => (
                  <span key={initials} className="relative w-9 h-9 rounded-full ring-2 ring-[#1d1a52] flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: color }}>
                    {initials}
                    <span className="trailer-pulse absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-mint-400 ring-2 ring-[#1d1a52]" style={{ animationDelay: `${i * 400}ms` }} />
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-white tabular-nums">12</p>
              <p className="text-[11px] text-white/50">tasks done</p>
            </div>
          </Tile>

          {/* Sync */}
          <Tile className="col-span-3 flex items-center justify-between">
            <div>
              <Label>Synced</Label>
              <div className="flex items-center gap-2.5 mt-2.5">
                <AppLogo app="jira" size={32} />
                <span className="trailer-sync text-white/60" aria-hidden="true">⟳</span>
                <AppLogo app="teams" size={32} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="trailer-chip">In review</span>
              <span className="trailer-chip trailer-chip-b">Meeting done</span>
            </div>
          </Tile>
        </div>

        <div className="flex flex-wrap gap-2">
          {[['⏱', 'Time saved'], ['◎', 'Focus'], ['↗', 'Growth'], ['✓', 'Delivery']].map(([icon, word]) => (
            <span key={word} className="inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium text-white/80 bg-white/[.06] ring-1 ring-inset ring-white/10">
              <span className="text-white/60">{icon}</span>{word}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
