import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLeaderboard, SCORE_PARTS, BADGES } from '../hooks/useLeaderboard'
import { presetRange, formatRange } from '../utils/dates'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import Tooltip from '../components/ui/Tooltip'
import SharingSwitch from '../components/SharingSwitch'

const PERIODS = [['this_week', 'This week'], ['this_month', 'This month'], ['last_month', 'Last month'], ['last_3_months', '3 months']]
const PERIOD_KEY = 'stridelog:leaderboard_period'

const fmt = v => (v == null ? <span className="text-gray-300">n/a</span> : v)

function Meter({ value, className = '' }) {
  return (
    <div className={`h-1.5 rounded-full bg-gray-100 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-primary-600 transition-[width] duration-700 ease-out" style={{ width: `${value ?? 0}%` }} />
    </div>
  )
}

function BadgeChips({ badges = [] }) {
  return badges.map(b => (
    <span key={b} title={BADGES[b]?.tip}
      className="inline-flex items-center gap-1 rounded-full bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100 px-2 py-0.5 text-[11px] font-medium">
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
        <Icon name="down" size={18} className={`text-gray-400 group-hover:text-gray-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SCORE_PARTS.map(p => (
              <div key={p.key} className="rounded-lg border border-gray-200 p-3.5 transition-colors hover:border-primary-200 hover:bg-primary-50/40">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                  <span className="text-xs font-semibold text-primary-700 tabular-nums">{p.weight}%</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{p.tip}</p>
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(i => (
        <Card key={i.key} interactive className="p-4">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-lg bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100 flex items-center justify-center"><Icon name={i.icon} size={16} /></span>
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
      ))}
    </div>
  )
}

function Podium({ rows }) {
  const top = rows.filter(r => r.eligible && r.rank <= 3).slice(0, 3)
  if (!top.length) return null
  const ring = ['ring-accent-500', 'ring-gray-300', 'ring-[#c58a5a]']
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {top.map(p => (
        <Card key={p.user_id} interactive className={`p-5 flex items-center gap-4 ${p.rank === 1 ? 'sm:order-2 sm:-translate-y-1' : p.rank === 2 ? 'sm:order-1' : 'sm:order-3'}`}>
          <div className="relative shrink-0">
            <Avatar person={p} size="lg" className={`ring-2 ring-offset-2 ring-offset-surface ${ring[p.rank - 1] ?? ''}`} />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center ring-2 ring-surface">{p.rank}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{p.name}{p.is_me && <span className="font-normal text-gray-500"> (you)</span>}</p>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums leading-tight">{p.score}<span className="text-sm font-normal text-gray-500"> / 100</span></p>
            <div className="mt-1 flex flex-wrap gap-1"><BadgeChips badges={p.badges} /></div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// Full ranking with every part of the score (managers, HR, admins).
function Ranking({ rows }) {
  const ranked = rows.filter(r => r.eligible)
  const waiting = rows.filter(r => !r.eligible)
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="section-title">Everyone</p>
        <p className="section-hint">Hover a column title to see what it measures.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Employee</th>
              <th className="w-44">Score</th>
              {SCORE_PARTS.map(p => (
                <th key={p.key} className="text-right">
                  <span className="inline-flex items-center gap-1">{p.label} <Tooltip align="right" text={`${p.tip} Weight ${p.weight}%.`} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map(r => (
              <tr key={r.user_id}>
                <td className="tabular-nums font-semibold text-gray-700">{r.rank}</td>
                <td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar person={r} size="xs" />
                    <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
                    <span className="hidden xl:flex gap-1"><BadgeChips badges={r.badges} /></span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-sm font-semibold text-gray-900 tabular-nums">{r.score}</span>
                    <Meter value={r.score} className="flex-1" />
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
    <Card className="p-5">
      <p className="section-title">Worth a check in</p>
      <p className="section-hint mb-3">Only you can see this. A low number often means blockers or unclear work, not low effort.</p>
      <ul className="space-y-2">
        {list.map(r => (
          <li key={r.user_id} className="flex items-center gap-3 text-sm">
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
    consistency: 'Submitting your day, even a short one, lifts consistency fastest.',
    follow_through: 'Plan a little less and finish it; carried over tasks lower follow through.',
    on_time: 'Flag blockers early on assigned tasks so due dates can move before they are missed.',
    growth: 'Small steady steps count: growth compares you only with your own last period.',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <Avatar person={me} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Your score <span className="font-normal text-gray-500">(only you see this breakdown)</span></p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums leading-tight">
            {me.eligible ? me.score : 'Not ranked yet'}{me.eligible && <span className="text-sm font-normal text-gray-500"> / 100{me.rank ? `, rank ${me.rank}` : ''}</span>}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {SCORE_PARTS.map(p => (
          <div key={p.key}>
            <p className="text-xs text-gray-500 flex items-center gap-1">{p.label}<Tooltip text={p.tip} /></p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{fmt(me[p.key])}</p>
            <Meter value={me[p.key]} className="mt-1" />
          </div>
        ))}
      </div>
      {!me.eligible && <p className="mt-4 text-sm text-gray-600">You need at least 3 working days and 3 tasks in this period to be ranked.</p>}
      {me.eligible && weakest && <p className="mt-4 text-sm text-gray-600"><span className="font-medium text-gray-900">Tip: </span>{advice[weakest.key]}</p>}
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
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Leaderboard</h2>
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
        <div className="space-y-3"><Card className="h-28 skeleton" /><Card className="h-64 skeleton" /></div>
      ) : (
        <div className="space-y-5 page-in" key={period}>
          {!full && <MyScore me={me} />}
          <Highlights rows={rows} />
          <Podium rows={rows} />
          {full ? (
            <>
              <Ranking rows={rows} />
              <Support rows={rows} />
            </>
          ) : rows.some(r => r.eligible && r.rank > 3 && r.rank <= 5) && (
            <Card className="divide-y divide-gray-100">
              {rows.filter(r => r.eligible && r.rank > 3 && r.rank <= 5).map(r => (
                <div key={r.user_id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/60">
                  <span className="w-6 text-sm font-semibold text-gray-500 tabular-nums">{r.rank}</span>
                  <Avatar person={r} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{r.name}{r.is_me && <span className="font-normal text-gray-500"> (you)</span>}</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{r.score}</span>
                </div>
              ))}
            </Card>
          )}
          <HowItWorks />
        </div>
      )}
    </div>
  )
}
