import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useAnalytics'
import { useFilters } from '../hooks/useFilters'
import { useHolidays } from '../hooks/useOrg'
import { formatRange, todayISO } from '../utils/dates'
import { statusCounts, attention, insights } from '../utils/insights'
import { downloadWorkbook } from '../lib/sheets'
import { toast } from '../lib/toast'
import { ROLE_LABELS } from '../lib/permissions'
import { reportSheets } from '../components/reports/exportSheets'
import FilterBar from '../components/FilterBar'
import { DoneColumns } from '../components/charts/Charts'
import ReportButton from '../components/reports/ReportButton'
import { StatusTiles, StatusRing, StackBars, PeopleTable, TaskTable } from '../components/reports/ReportParts'
import Card, { Section } from '../components/ui/Card'
import Tooltip from '../components/ui/Tooltip'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

// Productivity report: what got done in the period, by whom and on which
// project, how each person and project is trending, and every task.
export default function Reports() {
  const today = todayISO()
  const { filters, setFilter } = useFilters('this_week')
  const { data, isLoading, isFetching, allPeople, projects } = useDashboard(filters)
  const { data: holidays } = useHolidays()
  const [status, setStatus] = useState(null)   // show only this status
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)   // phones and tablets

  const peopleById = useMemo(() => Object.fromEntries(allPeople.map(p => [p.id, p])), [allPeople])
  const single = data && filters.person !== 'all' && data.persons.length === 1 ? data.persons[0] : null

  // Recomputed each render (cheap for a period of tasks); useMemo trips the
  // hooks lint because data.current reads like a ref.
  const view = (() => {
    if (!data) return null
    const q = search.trim().toLowerCase()
    const matches = t => !q || [t.title, peopleById[t.user_id]?.name, t.project, t.external_id].some(v => v?.toLowerCase().includes(q))
    const searched = data.tasks.filter(matches)
    const shown = status ? searched.filter(t => t.status === status) : searched
    const att = attention(data.tasks, today, holidays?.set)
    return {
      counts: statusCounts(searched),
      shown,
      att,
      notes: insights({ current: data.current, previous: data.previous, against: data.against, persons: data.persons, projects: data.projects, att }),
      byPerson: data.persons
        .map(p => { const list = shown.filter(t => t.user_id === p.id); return { id: p.id, name: p.name, counts: statusCounts(list), total: list.length } })
        .filter(r => r.total).sort((a, b) => b.counts.done - a.counts.done || b.total - a.total),
      byProject: [
        ...data.projects.map(p => { const list = shown.filter(t => t.project_id === p.id); return { id: p.id, name: p.name, counts: statusCounts(list), total: list.length, trend: p.trend } }),
        ...(() => { const list = shown.filter(t => !t.project_id); return list.length ? [{ id: 'none', name: 'No project', counts: statusCounts(list), total: list.length }] : [] })(),
      ].filter(r => r.total).sort((a, b) => b.counts.done - a.counts.done || b.total - a.total),
    }
  })()

  const title = single ? single.name : data?.project ? data.project.name : 'Productivity report'
  const period = formatRange(filters.from, filters.to)
  const subtitle = [
    single && ROLE_LABELS[single.role],
    data?.project && !single && `Project with ${data.project.members.length} ${data.project.members.length === 1 ? 'member' : 'members'}`,
    period,
  ].filter(Boolean).join(' · ')
  const size = data?.trend[0]?.size ?? 'week'

  async function save(format) {
    setSaving(true)
    try {
      const sheets = reportSheets({ title, period, tasks: view.shown, persons: data.persons, projects: data.projects, peopleById })
      await downloadWorkbook(`${title} ${period}`.replace(/[\\/:*?"<>|]/g, ' '), format === 'csv' ? sheets.slice(1) : sheets, format)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const REASON = { blocked: 'Blocked', overdue: 'Overdue', stuck: 'Stuck' }
  const clearAll = () => {
    setFilter({ person: 'all', project: 'all', sources: [] })
    setSearch('')
    setStatus(null)
  }

  return (
    <div className="max-w-[120rem] mx-auto grid grid-cols-1 lg:grid-cols-[15.5rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)] gap-5 items-start">
      {/* Left rail: what you are looking at (filters), then what it means. */}
      <aside className="space-y-4 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto scrollbar-none">
        <button type="button" onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}
          className="lg:hidden w-full flex items-center justify-between rounded-xl px-4 h-11 bg-primary-50 ring-1 ring-inset ring-primary-200 text-sm font-semibold text-primary-800 transition-colors active:bg-primary-100">
          <span className="flex items-center gap-2"><Icon name="filter" size={16} />Filters</span>
          <span className="flex items-center gap-2 text-xs font-medium text-primary-700">{period}<Icon name="down" size={16} className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} /></span>
        </button>
        <div className={`${filtersOpen ? 'block' : 'hidden'} lg:block`}>
          <FilterBar panel filters={filters} setFilter={setFilter} people={allPeople} projects={projects}
            onClear={clearAll} activeExtra={Number(Boolean(search.trim())) + Number(Boolean(status))}>
            <div className="relative">
              <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task, key or person"
                aria-label="Search tasks" className={`field !h-9 !py-0 !pl-9 ${search.trim() ? '!border-primary-500 ring-2 ring-primary-100' : ''}`} />
            </div>
          </FilterBar>
        </div>

        {view && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-mint-500 text-white flex items-center justify-center"><Icon name="trend" size={13} /></span>
                In short
              </p>
              <ul className="mt-3 space-y-2">
                {view.notes.filter(n => !n.includes('need attention')).map((n, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-gray-700 leading-snug">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />{n}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className={`p-4 ${view.att.total ? 'border-l-4 !border-l-red-500 !rounded-l-md' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-semibold ${view.att.total ? 'text-red-700' : 'text-gray-900'}`}>Needs attention <span className="tabular-nums">{view.att.total}</span></p>
                <Tooltip align="right" text="Open work that is blocked, past its due date, or has had no change for 5 working days." />
              </div>
              {view.att.total === 0 ? <p className="text-[13px] text-mint-700 mt-2">Nothing is stuck. Good.</p> : (
                <ul className="mt-2 -mx-2">
                  {view.att.items.slice(0, 6).map(({ task: t, reason, idle }, i) => (
                    // Phones show 3, so the numbers below stay close.
                    <li key={t.id} className={i >= 3 ? 'hidden md:block' : ''}>
                      <button type="button" onClick={() => setSearch(t.external_id ?? t.title)} title="Show this task below"
                        className="w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-red-50/70 active:bg-red-50">
                        <span className="block text-[13px] text-gray-900 truncate">{t.title}</span>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-red-700 shrink-0">{reason === 'stuck' ? `${REASON[reason]} ${idle} days` : REASON[reason]}</span>
                          <span className="truncate">{peopleById[t.user_id]?.name}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {view.att.total > 0 && (
                <Link to="/team?view=board" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                  {view.att.total > 6 ? `See all ${view.att.total} on the board` : 'Open the board'}<Icon name="right" size={13} />
                </Link>
              )}
            </Card>
          </div>
        )}
      </aside>

      {/* Main: the numbers. Container queries size it by its own width. */}
      <div className="@container min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 mr-auto">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight truncate">{title}</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => save('xlsx')} loading={saving} disabled={!view} title="Summary and every task, ready for Excel">
            <Icon name="download" size={15} />Excel
          </Button>
          <Button variant="outline" size="sm" className="max-sm:!hidden" onClick={() => save('csv')} disabled={!view || saving} title="Every task as a CSV file">CSV</Button>
          <ReportButton defaultScope="all" label="PDF"
            personId={filters.person !== 'all' ? filters.person : undefined}
            projectId={filters.project !== 'all' ? filters.project : undefined} />
        </div>

        {isLoading || !view ? (
          <div className="space-y-4">{[0, 1, 2].map(i => <Card key={i} className="h-28 skeleton" />)}</div>
        ) : (
          <div className={`space-y-4 transition-opacity duration-300 ${isFetching ? 'opacity-60' : ''}`}>
            <StatusTiles counts={view.counts} total={data.tasks.length} completion={data.current.completionRate}
              active={status} onToggle={s => setStatus(v => (v === s ? null : s))} />

            <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1fr)] gap-4">
              {/* The tiles above carry the same counts, so the ring only shows when there is room. */}
              <Section title="Status split" bodyClassName="px-5 pb-4 pt-3" className="hidden @5xl:block">
                <StatusRing counts={view.counts} />
              </Section>
              {!single && (
                <Section title="By employee" hint="Click a name to filter." bodyClassName="px-3 pb-3 pt-2">
                  <StackBars rows={view.byPerson} selected={filters.person} empty="No tasks for anyone yet."
                    onPick={id => setFilter({ person: filters.person === id ? 'all' : id })} />
                </Section>
              )}
              <Section title="By project" hint="Click a project to filter." bodyClassName="px-3 pb-3 pt-2" className={single ? '@2xl:col-span-2' : ''}>
                <StackBars rows={view.byProject} selected={filters.project} empty="No project work in this period."
                  onPick={id => id !== 'none' && setFilter({ project: filters.project === id ? 'all' : id })} />
              </Section>
            </div>

            {!single && data.persons.length > 0 && (
              <Section title={data.project ? 'Project members' : 'People'} bodyClassName="pt-1"
                hint="Click a name for their report. Each person is compared only with their own recent weeks.">
                <PeopleTable rows={data.persons} weeks={data.weeks} onOpen={id => setFilter({ person: id })} />
              </Section>
            )}

            <Section title={`Tasks finished each ${size}`} bodyClassName="px-5 pb-4 pt-2"
              hint={size === 'month' ? 'Solid bars are done, faded bars planned but not done.' : 'Last 8 weeks or more. Solid bars are done, faded bars planned but not done.'}>
              <DoneColumns data={data.trend} height={180} />
            </Section>

            <Section title={`Tasks (${view.shown.length})`} bodyClassName="pt-1"
              hint={status ? 'Showing one status. Click its tile again to show all.' : 'Click a column to sort, a row for its notes.'}>
              <TaskTable tasks={view.shown} peopleById={peopleById} />
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
