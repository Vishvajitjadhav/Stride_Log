import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLeaderboard, SCORE_PARTS, BADGES } from '../hooks/useLeaderboard'
import { presetRange, formatRange } from '../utils/dates'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import Tooltip from '../components/ui/Tooltip'
import { CountUp, Meter, ScoreRing } from '../components/ui/Motion'
import SharingSwitch from '../components/SharingSwitch'

const PERIODS = [['this_week', 'This week'], ['last_week', 'Last week'], ['this_month', 'This month'], ['last_month', 'Last month'], ['last_3_months', '3 months']]
const PERIOD_KEY = 'stridelog:leaderboard_period'

const fmt = v => (v == null ? <span className="text-gray-300">n/a</span> : v)

// One colour per badge so the highlights read at a glance.
const BADGE_LOOK = {
  consistent: 'from-violet-400 to-violet-600',
  finisher: 'from-mint-400 to-mint-600',
  reliable: 'from-primary-400 to-primary-600',
  improved: 'from-amber-400 to-orange-500',
}

// Gold, silver, bronze: ring, plinth and number colours per place.
const PLACE = {
  1: { ring: 'ring-amber-400', plinth: 'from-amber-300 to-amber-500', text: 'text-amber-950', height: 'h-28 sm:h-32', medal: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950' },
  2: { ring: 'ring-slate-300', plinth: 'from-slate-200 to-slate-400', text: 'text-slate-800', height: 'h-20 sm:h-24', medal: 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800' },
  3: { ring: 'ring-orange-300', plinth: 'from-orange-200 to-orange-400', text: 'text-orange-950', height: 'h-14 sm:h-16', medal: 'bg-gradient-to-br from-orange-200 to-orange-400 text-orange-950' },
}

function BadgeChips({ badges = [] }) {
  return badges.map(b => (
    <span key={b} title={BADGES[b]?.tip}
      className="inline-flex items-center gap-1 rounded-full bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      <Icon name={BADGES[b]?.icon} size={11} />{BADGES[b]?.label}
    </span>
  ))
}

// How the score is built, open by default the first time.
function HowItWorks() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('stridelog:lb_help') !== 'closed' } catch { return true } })
  const toggle = () => setOpen(o => { try { localStorage.setItem('stridelog:lb_help', o ? 'closed' : 'open') } catch { /* private mode */ } return !o })
  return (
    <Card>
      <button onClick={toggle} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left group">
        <span>
          <span className="block text-sm font-semibold text-gray-900">How the score works</span>
          <span className="block text-xs text-gray-500">Rates, not task counts, so small and large tasks are treated fairly.</span>
        </span>
        <Icon name="down" size={18} className={`text-gray-400 group-hover:text-gray-700 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 page-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SCORE_PARTS.map(p => (
              <div key={p.key} className="rounded-xl border border-gray-200 p-3.5 transition-colors hover:border-primary-200 hover:bg-primary-50/40">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                  <span className="text-xs font-semibold text-primary-700 tabular-nums">{p.weight}%</span>
                </div>
                <Meter value={p.weight * 2.5} className="mt-2" />
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">{p.tip}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Not counted: hours, number of tasks and weekend work, so nobody is pushed to split work into tiny tasks or overwork.
            People need at least 3 working days and 3 tasks in the period to be ranked.
          </p>
        </div>
      )}
    </Card>
  )
}

function Highlights({ rows }) {
  const items = Object.entries(BADGES).map(([key, b]) => ({ key, ...b, people: rows.filter(r => r.badges?.includes(key)) }))
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
      {items.map((i, n) => (
        <div key={i.key} style={{ '--i': n + 3 }} className="grid">
          <Card className="relative p-4 card-hover">
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
              <span className={`absolute -right-6 -top-6 w-20 h-20 rounded-full bg-gradient-to-br ${BADGE_LOOK[i.key]} opacity-10`} />
            </span>
            <div className="flex items-center justify-between">
              <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${BADGE_LOOK[i.key]} text-white flex items-center justify-center shadow-sm`}><Icon name={i.icon} size={17} strokeWidth={2.2} /></span>
              <Tooltip align="right" text={i.tip} />
            </div>
            <p className="mt-3 text-xs font-medium text-gray-500">{i.label}</p>
            {i.people.length ? (
              <div className="mt-1.5 space-y-1.5">
                {i.people.slice(0, 2).map(p => (
                  <div key={p.user_id} className="flex items-center gap-2 min-w-0">
                    <Avatar person={p} size="xs" />
                    <span className="text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                  </div>
                ))}
                {i.people.length > 2 && <p className="text-xs text-gray-500">and {i.people.length - 2} more</p>}
              </div>
            ) : <p className="mt-1.5 text-sm text-gray-400">Nobody yet</p>}
          </Card>
        </div>
      ))}
    </div>
  )
}

// Top three on plinths that rise in: second, first, third from left to right.
function Podium({ rows }) {
  const top = rows.filter(r => r.eligible && r.rank <= 3).slice(0, 3)
  if (!top.length) return null
  const order = [2, 1, 3].map(rank => top.find(p => p.rank === rank)).filter(Boolean)
  return (
    <Card className="relative px-3 sm:px-6 pt-6 sm:pt-8 overflow-hidden">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_16rem_at_50%_0%,var(--color-primary-50),transparent_70%)]" aria-hidden="true" />
      <div className="relative grid grid-cols-3 items-end gap-2 sm:gap-5 max-w-2xl mx-auto">
        {order.map((p, i) => {
          const look = PLACE[p.rank] ?? PLACE[3]
          return (
            <div key={p.user_id} className="flex flex-col items-center text-center min-w-0 rise" style={{ animationDelay: `${[200, 0, 350][i]}ms` }}>
              <div className="relative">
                {p.rank === 1 && <Icon name="crown" size={26} strokeWidth={2} className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500 fill-amber-300 float" />}
                <Avatar person={p} size="lg" className={`ring-4 ring-offset-2 ring-offset-surface ${look.ring} ${p.rank === 1 ? 'sm:!w-20 sm:!h-20 sm:!text-2xl' : ''}`} />
                <span className={`absolute -bottom-1 -right-2 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ring-2 ring-surface shadow ${look.medal}`}>{p.rank}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900 truncate max-w-full">{p.name}{p.is_me && <span className="font-normal text-gray-500"> (you)</span>}</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900 tabular-nums leading-tight"><CountUp value={p.score} /><span className="text-xs font-normal text-gray-500"> / 100</span></p>
              <div className="mt-1 hidden sm:flex flex-wrap justify-center gap-1 min-h-5"><BadgeChips badges={p.badges} /></div>
              <div className={`mt-3 w-full rounded-t-2xl bg-gradient-to-b ${look.plinth} ${look.height} grow-up flex items-start justify-center pt-2 shadow-inner`}
                style={{ animationDelay: `${[250, 50, 400][i]}ms` }}>
                <span className={`text-2xl sm:text-3xl font-black opacity-40 ${look.text}`}>{p.rank}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// Full ranking with every part of the score (managers, HR, admins).
function Ranking({ rows }) {
  const ranked = rows.filter(r => r.eligible)
  const waiting = rows.filter(r => !r.eligible)
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="section-title">Everyone</p>
        <p className="section-hint"><span className="hidden md:inline">Hover a column title to see what it measures.</span><span className="md:hidden">Ranked by overall score.</span></p>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Employee</th>
              <th className="w-48">Score</th>
              {SCORE_PARTS.map(p => (
                <th key={p.key} className="text-right">
                  <span className="inline-flex items-center gap-1">{p.label} <Tooltip align="right" text={`${p.tip} Weight ${p.weight}%.`} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="stagger">
            {ranked.map((r, i) => (
              <tr key={r.user_id} style={{ '--i': Math.min(i, 14) }} className="hover:bg-primary-50/40">
                <td>
                  <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold tabular-nums ${PLACE[r.rank]?.medal ?? 'bg-gray-100 text-gray-600'}`}>{r.rank}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar person={r} size="sm" />
                    <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
                    <span className="hidden xl:flex gap-1"><BadgeChips badges={r.badges} /></span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 text-sm font-semibold text-gray-900 tabular-nums">{r.score}</span>
                    <Meter value={r.score} className="flex-1 !h-2" />
                  </div>
                </td>
                <td className="text-right tabular-nums text-sm" title={`${r.logged_days} of ${r.expected_days} working days logged`}>{fmt(r.consistency)}</td>
                <td className="text-right tabular-nums text-sm" title={`${r.done} of ${r.planned} planned tasks finished`}>{fmt(r.follow_through)}</td>
                <td className="text-right tabular-nums text-sm" title={r.on_time_base ? `${r.on_time_base} assigned tasks were due` : 'Fewer than two assigned tasks were due'}>{fmt(r.on_time)}</td>
                <td className="text-right tabular-nums text-sm">{fmt(r.growth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per person, the score parts as small meters. */}
      <ul className="md:hidden divide-y divide-gray-100 stagger">
        {ranked.map((r, i) => (
          <li key={r.user_id} style={{ '--i': Math.min(i, 12) }} className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className={`inline-flex w-7 h-7 shrink-0 rounded-full items-center justify-center text-xs font-bold tabular-nums ${PLACE[r.rank]?.medal ?? 'bg-gray-100 text-gray-600'}`}>{r.rank}</span>
              <Avatar person={r} size="sm" />
              <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate">{r.name}</span>
              <ScoreRing value={r.score} size={40} stroke={4} label={`${r.name} score`} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2.5 pl-10">
              {SCORE_PARTS.map(p => (
                <div key={p.key} className="min-w-0">
                  <p className="text-[10px] text-gray-500 truncate">{p.label}</p>
                  <p className="text-xs font-semibold text-gray-800 tabular-nums">{fmt(r[p.key])}</p>
                  <Meter value={r[p.key]} className="mt-1 !h-1" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {waiting.length > 0 && (
        <p className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
          Not ranked yet (fewer than 3 working days or 3 tasks in this period): {waiting.map(w => w.name).join(', ')}.
        </p>
      )}
    </Card>
  )
}

// Gentle prompts for managers: who might need a check in. Never shown to employees.
function Support({ rows }) {
  const list = rows.filter(r => r.eligible && ((r.consistency ?? 100) < 60 || (r.follow_through ?? 100) < 50))
  if (!list.length) return null
  return (
    <Card className="p-5 border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-surface">
      <p className="section-title flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Icon name="bell" size={15} /></span>Worth a check in</p>
      <p className="section-hint mb-3">Only you can see this. A low number often means blockers or unclear work, not low effort.</p>
      <ul className="space-y-2">
        {list.map(r => (
          <li key={r.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Avatar person={r} size="xs" />
            <span className="font-medium text-gray-900">{r.name}</span>
            <span className="text-gray-500">
              {[(r.consistency ?? 100) < 60 && `logged ${r.logged_days} of ${r.expected_days} days`, (r.follow_through ?? 100) < 50 && `finished ${r.done} of ${r.planned} tasks`].filter(Boolean).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Employees: their own breakdown with one friendly suggestion.
function MyScore({ me }) {
  if (!me) return null
  const parts = SCORE_PARTS.filter(p => me[p.key] != null)
  // Growth above 50 already means improving, so only suggest it when it dips.
  const weakest = [...parts].filter(p => p.key !== 'growth' || me.growth < 50).sort((a, b) => me[a.key] - me[b.key])[0]
  const advice = {
    consistency: 'Updating your tasks every working day, even one small one, lifts consistency fastest.',
    follow_through: 'Plan a little less and finish it; carried over tasks lower follow through.',
    on_time: 'Flag blockers early on assigned tasks so due dates can move before they are missed.',
    growth: 'Small steady steps count: growth compares you only with your own last period.',
  }
  return (
    <Card className="p-5 sm:p-6 bg-gradient-to-br from-primary-50/70 via-surface to-mint-50/50">
      <div className="flex items-center gap-4 sm:gap-5">
        {me.eligible ? <ScoreRing value={me.score} size={84} stroke={8} label="Your score" /> : <Avatar person={me} size="lg" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Your score</p>
          <p className="text-xs text-gray-500">Only you see this breakdown</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {me.eligible ? (me.rank ? <>Rank <span className="text-gradient">{me.rank}</span></> : 'Ranked') : 'Not ranked yet'}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {SCORE_PARTS.map(p => (
          <div key={p.key}>
            <p className="text-xs text-gray-500 flex items-center gap-1">{p.label}<Tooltip text={p.tip} /></p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{me[p.key] == null ? fmt(null) : <CountUp value={me[p.key]} />}</p>
            <Meter value={me[p.key]} className="mt-1" />
          </div>
        ))}
      </div>
      {!me.eligible && <p className="mt-4 text-sm text-gray-600">You need at least 3 working days and 3 tasks in this period to be ranked.</p>}
      {me.eligible && weakest && (
        <p className="mt-4 text-sm text-gray-600 rounded-xl bg-surface/80 border border-gray-200/70 px-3.5 py-2.5">
          <span className="font-semibold text-primary-700">Tip: </span>{advice[weakest.key]}
        </p>
      )}
    </Card>
  )
}

export default function Leaderboard() {
  const { can } = useAuth()
  const full = can('viewTeam')
  const [period, setPeriod] = useState(() => { try { return localStorage.getItem(PERIOD_KEY) || 'this_month' } catch { return 'this_month' } })
  const pick = k => { setPeriod(k); try { localStorage.setItem(PERIOD_KEY, k) } catch { /* private mode */ } }
  const range = presetRange(period)
  const { data: rows = [], isLoading, error } = useLeaderboard(range)
  const me = rows.find(r => r.is_me)

  return (
    <div className="max-w-6xl 2xl:max-w-7xl 3xl:max-w-[88rem] mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 flex items-center justify-center shadow-sm"><Icon name="trophy" size={19} strokeWidth={2} /></span>
            Leaderboard
          </h2>
          <p className="page-subtitle">Recognising steady, reliable work. {formatRange(range.from, range.to)}.</p>
        </div>
        <SharingSwitch what="leaderboard" tip="When on, employees see the highlights, the top five and their own score. The full table and check in list stay private to managers." />
      </div>

      <div className="segmented" role="group" aria-label="Period">
        {PERIODS.map(([k, l]) => <button key={k} aria-pressed={period === k} onClick={() => pick(k)}>{l}</button>)}
      </div>

      {error ? (
        <Card className="p-8 text-center text-sm text-gray-600">{error.message}</Card>
      ) : isLoading ? (
        <div className="space-y-3"><Card className="h-56 skeleton" /><Card className="h-64 skeleton" /></div>
      ) : (
        <div className="space-y-5 page-in" key={period}>
          {!full && <MyScore me={me} />}
          <Podium rows={rows} />
          <Highlights rows={rows} />
          {full ? (
            <>
              <Ranking rows={rows} />
              <Support rows={rows} />
            </>
          ) : rows.some(r => r.eligible && r.rank > 3 && r.rank <= 5) && (
            <Card className="divide-y divide-gray-100 stagger">
              {rows.filter(r => r.eligible && r.rank > 3 && r.rank <= 5).map((r, i) => (
                <div key={r.user_id} style={{ '--i': i }} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-primary-50/40">
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tabular-nums flex items-center justify-center">{r.rank}</span>
                  <Avatar person={r} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{r.name}{r.is_me && <span className="font-normal text-gray-500"> (you)</span>}</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{r.score}</span>
                </div>
              ))}
            </Card>
          )}
          {!rows.some(r => r.eligible) && (
            <Card className="p-10 text-center">
              <span className="mx-auto w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center float"><Icon name="trophy" size={22} /></span>
              <p className="mt-3 text-sm font-semibold text-gray-900">Nobody is ranked yet for this period</p>
              <p className="text-xs text-gray-500 mt-1">People appear after 3 working days and 3 tasks.</p>
            </Card>
          )}
          <HowItWorks />
        </div>
      )}
    </div>
  )
}
