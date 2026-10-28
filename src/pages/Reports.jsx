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
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

// Productivity report: what got done in the period, by whom and on which
// project, how each person and project is trending, and every task.
export default function Reports() {
  const today = todayISO()
  const { filters, setFilter } = useFilters('this_week')
  const { data, isLoading, allPeople, projects } = useDashboard(filters)
  const { data: holidays } = useHolidays()
  const [status, setStatus] = useState(null)   // show only this status
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="max-w-6xl 2xl:max-w-7xl 3xl:max-w-[88rem] mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title">{title}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => save('xlsx')} loading={saving} disabled={!view} title="Summary and every task, ready for Excel">
            <Icon name="download" size={16} /><span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" onClick={() => save('csv')} disabled={!view || saving} className="hidden sm:inline-flex" title="Every task as a CSV file">CSV</Button>
          <ReportButton defaultScope="all" label="PDF report"
            personId={filters.person !== 'all' ? filters.person : undefined}
            projectId={filters.project !== 'all' ? filters.project : undefined} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterBar filters={filters} setFilter={setFilter} people={allPeople} projects={projects} />
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task, key or person"
          aria-label="Search tasks" className="field !h-9 !py-0 sm:!w-56" />
      </div>

      {isLoading || !view ? (
        <div className="space-y-4">{[0, 1, 2].map(i => <Card key={i} className="h-32 skeleton" />)}</div>
      ) : (
        <>
          <Section title="In short" hint="Written from the numbers below, for a quick read."
            actions={view.att.total > 0 && <Link to="/team?view=board" className="text-sm font-semibold text-primary-600 hover:text-primary-700">Open the board</Link>}>
            <ul className="space-y-2.5 stagger">
              {view.notes.map((n, i) => (
                <li key={i} style={{ '--i': i }} className="flex gap-3 text-sm sm:text-[15px] text-gray-700 leading-relaxed">
                  <span className="mt-2 w-2 h-2 rounded-full bg-gradient-to-br from-primary-400 to-mint-400 ring-4 ring-primary-50 shrink-0" />{n}
                </li>
              ))}
            </ul>
          </Section>

          <StatusTiles counts={view.counts} total={data.tasks.length} completion={data.current.completionRate}
            active={status} onToggle={s => setStatus(v => (v === s ? null : s))} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title="Status split" hint="Where all planned work stands now.">
              <StatusRing counts={view.counts} />
            </Section>
            {!single && (
              <Section title="By employee" hint="Click a name to see only their work.">
                <StackBars rows={view.byPerson} selected={filters.person} empty="No tasks for anyone yet."
                  onPick={id => setFilter({ person: filters.person === id ? 'all' : id })} />
              </Section>
            )}
            <Section title="By project" hint="Click a project to see only its work." className={single ? 'lg:col-span-2' : ''}>
              <StackBars rows={view.byProject} selected={filters.project} empty="No project work in this period."
                onPick={id => id !== 'none' && setFilter({ project: filters.project === id ? 'all' : id })} />
            </Section>
          </div>

          {!single && data.persons.length > 0 && (
            <Section title={data.project ? 'Project members' : 'People'} bodyClassName="pt-2"
              hint="Click a name for their report. Each person is compared only with their own recent weeks.">
              <PeopleTable rows={data.persons} weeks={data.weeks} onOpen={id => setFilter({ person: id })} />
            </Section>
          )}

          <Section title={`Tasks finished each ${size}`}
            hint={size === 'month' ? 'Solid bars show tasks done; faded bars show tasks planned but not done.' : 'At least the last 8 weeks. Solid bars show tasks done; faded bars show tasks planned but not done.'}>
            <DoneColumns data={data.trend} />
          </Section>

          <Section title={`Tasks (${view.shown.length})`} bodyClassName="pt-1"
            hint={status ? 'Showing one status. Click its tile again to show all.' : 'Click a column to sort, a row for its notes.'}>
            <TaskTable tasks={view.shown} peopleById={peopleById} />
          </Section>
        </>
      )}
    </div>
  )
}
