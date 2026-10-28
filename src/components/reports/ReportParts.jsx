import { Fragment, useMemo, useState } from 'react'
import { STATUSES, STATUS_LABELS, STATUS_STYLE } from '../../lib/status'
import { TREND, STATUS_ORDER as ORDER } from '../../utils/insights'
import { formatShort } from '../../utils/dates'
import { StatusBadge } from '../ui/Badge'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'


// ── Status tiles: click one to show only that status ───────────────────────
export function StatusTiles({ counts, total, completion, active, onToggle }) {
  const tile = 'rounded-xl border p-3 text-left transition-all duration-150 hover:-translate-y-px hover:shadow-sm'
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
      <div className={`${tile} bg-surface border-gray-200 hover:translate-y-0 hover:shadow-none`}>
        <p className="text-xs text-gray-500 flex items-center gap-1">Planned<Tooltip text="Every task planned for the period, whatever its status." /></p>
        <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-0.5">{total}</p>
      </div>
      {ORDER.map(s => (
        <button key={s} onClick={() => onToggle(s)} aria-pressed={active === s} title={active === s ? 'Show every status' : `Show only ${STATUS_LABELS[s]}`}
          className={`${tile} ${active === s ? `${STATUS_STYLE[s].card} ring-2 ring-primary-300` : 'bg-surface border-gray-200'}`}>
          <p className="text-xs text-gray-500 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${STATUS_STYLE[s].dot}`} />{STATUS_LABELS[s]}</p>
          <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${counts[s] && s === 'blocked' ? 'text-red-700' : 'text-gray-900'}`}>{counts[s]}</p>
        </button>
      ))}
      <div className={`${tile} bg-surface border-gray-200 hover:translate-y-0 hover:shadow-none`}>
        <p className="text-xs text-gray-500 flex items-center gap-1">Completion<Tooltip align="right" text="Tasks done out of tasks planned in the period." /></p>
        <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${completion >= 80 ? 'text-mint-700' : completion >= 50 ? 'text-amber-800' : 'text-red-700'}`}>{completion}%</p>
      </div>
    </div>
  )
}

// ── Status split ring ───────────────────────────────────────────────────────
export function StatusRing({ counts }) {
  const total = STATUSES.reduce((n, s) => n + counts[s], 0)
  let at = 0
  const stops = ORDER.filter(s => counts[s]).map(s => {
    const from = at
    at += (counts[s] / total) * 100
    return `${STATUS_STYLE[s].hex} ${from}% ${at}%`
  })
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative w-36 h-36 rounded-full shrink-0" role="img" aria-label={ORDER.map(s => `${STATUS_LABELS[s]} ${counts[s]}`).join(', ')}
        style={{ background: total ? `conic-gradient(${stops.join(', ')})` : 'var(--color-gray-200)' }}>
        <div className="absolute inset-5 rounded-full bg-surface flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-gray-900 tabular-nums">{total}</span>
          <span className="text-[11px] text-gray-500">tasks</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {ORDER.map(s => (
          <li key={s} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_STYLE[s].dot}`} />
            <span className="text-gray-600 w-24">{STATUS_LABELS[s]}</span>
            <span className="font-semibold text-gray-900 tabular-nums">{counts[s]}</span>
            <span className="text-xs text-gray-400 tabular-nums">{total ? Math.round((counts[s] / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Stacked status bars per employee or project; click one to filter ────────
//   rows: [{ id, name, counts, total, trend? }]
export function StackBars({ rows, selected, onPick, empty }) {
  const max = Math.max(1, ...rows.map(r => r.total))
  if (!rows.length) return <p className="text-sm text-gray-500 py-4">{empty}</p>
  return (
    <div className="space-y-1">
      {rows.map(r => (
        <button key={r.id} onClick={() => onPick(r.id)} aria-pressed={selected === r.id}
          className={`w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50 ${selected === r.id ? 'bg-primary-50 ring-1 ring-primary-200' : ''}`}>
          <span className="w-28 sm:w-32 shrink-0 text-sm text-gray-800 truncate" title={r.name}>{r.name}</span>
          <span className="flex-1 min-w-0 h-5 rounded-md bg-gray-100 overflow-hidden flex" style={{ maxWidth: `${(r.total / max) * 100}%` }}
            title={ORDER.filter(s => r.counts[s]).map(s => `${STATUS_LABELS[s]} ${r.counts[s]}`).join(', ')}>
            {ORDER.map(s => r.counts[s] > 0 && (
              <span key={s} className={`h-full ${STATUS_STYLE[s].dot}`} style={{ width: `${(r.counts[s] / r.total) * 100}%` }} />
            ))}
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-gray-500 tabular-nums">{r.counts.done} of {r.total}</span>
        </button>
      ))}
    </div>
  )
}

// ── Trend pill and tiny week by week bars ──────────────────────────────────
export function TrendPill({ trend }) {
  const t = TREND[trend] ?? TREND.new
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${t.cls}`}>
      {t.icon && <Icon name={t.icon} size={12} className={trend === 'down' ? '-scale-y-100' : ''} />}{t.label}
    </span>
  )
}

export function Spark({ series, weeks }) {
  const max = Math.max(1, ...series)
  return (
    <span className="inline-flex items-end gap-0.5 h-6" role="img" aria-label={`Tasks done per week: ${series.join(', ')}`}>
      {series.map((v, i) => (
        <span key={i} title={`Week of ${formatShort(weeks[i])}: ${v} done`}
          className={`w-1.5 rounded-sm ${i >= series.length - 3 ? 'bg-primary-500' : 'bg-primary-200'}`} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </span>
  )
}

// ── People: output, follow through, showing up, and their own trend ─────────
export function PeopleTable({ rows, weeks, onOpen }) {
  const [sort, setSort] = useState({ key: 'done', dir: -1 })
  const sorted = useMemo(() => [...rows].sort((a, b) =>
    (sort.key === 'name' ? a.name.localeCompare(b.name) : (a[sort.key] - b[sort.key])) * sort.dir || a.name.localeCompare(b.name)), [rows, sort])
  const th = (key, label, tip, cls = 'text-right') => (
    <th className={cls}>
      <button onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))} className="inline-flex items-center gap-1 hover:text-gray-900">
        {label}{sort.key === key && <Icon name="down" size={12} className={sort.dir > 0 ? 'rotate-180' : ''} />}
      </button>
      {tip && <Tooltip text={tip} className="ml-1" />}
    </th>
  )
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[640px]">
        <thead>
          <tr>
            {th('name', 'Employee', null, 'text-left')}
            {th('done', 'Done', 'Tasks finished out of tasks planned in the period.')}
            {th('completionRate', 'Completion', 'Share of planned tasks that are done.')}
            {th('loggedDays', 'Active days', 'Working days with work logged, out of working days so far.')}
            <th className="text-right">Last 6 weeks <Tooltip align="right" text="Tasks finished each week. The last 3 weeks (darker) are compared with the 3 before, so each person is only compared with themselves." /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="cursor-pointer" onClick={() => onOpen(r.id)}>
              <td>
                <span className="flex items-center gap-2.5 min-w-0">
                  <Avatar person={r} size="xs" />
                  <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
                </span>
              </td>
              <td className="text-right tabular-nums"><b className="font-semibold text-gray-900">{r.done}</b> of {r.planned}</td>
              <td className="text-right tabular-nums">{r.planned ? `${r.completionRate}%` : <span className="text-gray-400">No tasks</span>}</td>
              <td className="text-right tabular-nums">{r.loggedDays} of {r.expectedDays}</td>
              <td className="text-right">
                <span className="inline-flex items-center gap-3"><Spark series={r.series} weeks={weeks} /><TrendPill trend={r.trend} /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Every task, sortable, click a row for its notes ─────────────────────────
const SOURCE = { manual: 'StrideLog', jira: 'Jira', teams: 'Teams' }
const PAGE = 50

export function TaskTable({ tasks, peopleById }) {
  const [sort, setSort] = useState({ key: 'date', dir: -1 })
  const [open, setOpen] = useState(() => new Set())
  const [shown, setShown] = useState(PAGE)
  const value = (t, k) => (k === 'person' ? peopleById[t.user_id]?.name ?? '' : k === 'status' ? STATUSES.indexOf(t.status) : String(t[k] ?? '').toLowerCase())
  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    const x = value(a, sort.key), y = value(b, sort.key)
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir
  }), [tasks, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOpen = sorted.length > 0 && sorted.slice(0, shown).every(t => open.has(t.id))
  const th = (key, label, cls = '') => (
    <th className={cls}>
      <button onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }))} className="inline-flex items-center gap-1 hover:text-gray-900">
        {label}{sort.key === key && <Icon name="down" size={12} className={sort.dir > 0 ? 'rotate-180' : ''} />}
      </button>
    </th>
  )

  if (!tasks.length) return <p className="text-sm text-gray-500 text-center py-8">No tasks match these filters.</p>
  return (
    <div>
      <div className="flex justify-end px-5 pb-2">
        <button onClick={() => setOpen(allOpen ? new Set() : new Set(sorted.slice(0, shown).map(t => t.id)))} className="text-xs font-medium text-primary-700 hover:text-primary-900">
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              {th('title', 'Task')}
              {th('person', 'Employee')}
              {th('project', 'Project')}
              {th('date', 'Date')}
              {th('status', 'Status', 'text-right')}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, shown).map(t => (
              <Fragment key={t.id}>
                <tr className="cursor-pointer" onClick={() => toggle(t.id)}>
                  <td className="max-w-[22rem]">
                    <span className="flex items-start gap-2">
                      <Icon name="right" size={14} className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${open.has(t.id) ? 'rotate-90' : ''}`} />
                      <span className={`text-sm ${t.status === 'done' ? 'text-gray-600' : 'text-gray-900'}`}>{t.title}</span>
                    </span>
                  </td>
                  <td className="text-sm whitespace-nowrap">{peopleById[t.user_id]?.name ?? ''}</td>
                  <td className="text-sm text-gray-600 whitespace-nowrap">{t.project ?? ''}</td>
                  <td className="text-sm text-gray-600 whitespace-nowrap tabular-nums">{formatShort(t.date)}</td>
                  <td className="text-right"><StatusBadge status={t.status} /></td>
                </tr>
                {open.has(t.id) && (
                  <tr>
                    <td colSpan={5} className="!pt-0 bg-gray-50/60">
                      <div className="pl-6 py-2 text-sm text-gray-700 space-y-1">
                        <p className="whitespace-pre-wrap">{t.description || <span className="text-gray-400">No notes.</span>}</p>
                        <p className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                          <span>From {SOURCE[t.source] ?? 'StrideLog'}</span>
                          {t.category && <span>{t.category}</span>}
                          {t.due_date && <span>Due {formatShort(t.due_date)}</span>}
                          {t.completed_on && <span>Done {formatShort(t.completed_on)}</span>}
                          {t.external_url && <a href={t.external_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="font-medium text-primary-700 hover:underline">Open {t.external_id ?? 'in Jira'}</a>}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > shown && (
        <button onClick={() => setShown(n => n + PAGE)} className="w-full text-sm font-medium text-primary-700 hover:text-primary-900 py-3">
          Show {Math.min(PAGE, sorted.length - shown)} more of {sorted.length - shown}
        </button>
      )}
    </div>
  )
}
