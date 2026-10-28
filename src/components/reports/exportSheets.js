// The Reports page as spreadsheet rows: a Summary sheet (by employee, by
// project, overall) and a Tasks sheet with every task. Pure, so it is tested.
import { STATUS_LABELS } from '../../lib/status'
import { statusCounts, STATUS_ORDER, TREND } from '../../utils/insights'

const SOURCE = { manual: 'StrideLog', jira: 'Jira', teams: 'Teams' }
const HEAD = ['Planned', ...STATUS_ORDER.map(s => STATUS_LABELS[s]), 'Completion %']

function counts(list) {
  const c = statusCounts(list)
  return [list.length, ...STATUS_ORDER.map(s => c[s]), list.length ? Math.round((c.done / list.length) * 100) : 0]
}

//   persons: rows from useDashboard (name, loggedDays, expectedDays, trend)
//   projects: [{ id, name }]   tasks: tasks of the period, already filtered
export function reportSheets({ title, period, tasks, persons, projects, peopleById }) {
  const noProject = tasks.filter(t => !t.project_id)
  const summary = [
    [title], [period], [],
    ['By employee'],
    ['Employee', ...HEAD, 'Active days', 'Trend'],
    ...persons.map(p => [p.name, ...counts(tasks.filter(t => t.user_id === p.id)), `${p.loggedDays} of ${p.expectedDays}`, TREND[p.trend]?.label ?? '']),
    [],
    ['By project'],
    ['Project', ...HEAD],
    ...projects.map(p => [p.name, ...counts(tasks.filter(t => t.project_id === p.id))]).filter(r => r[1] > 0),
    ...(noProject.length ? [['No project', ...counts(noProject)]] : []),
    [],
    ['Overall'],
    ['', ...HEAD],
    ['All tasks', ...counts(tasks)],
  ]
  const taskRows = [
    ['Task', 'Status', 'Employee', 'Project', 'Planned for', 'Done on', 'Due', 'From', 'Jira key', 'Notes'],
    ...tasks.map(t => [
      t.title, STATUS_LABELS[t.status] ?? t.status, peopleById[t.user_id]?.name ?? '', t.project ?? '', t.date,
      t.completed_on ?? '', t.due_date ?? '', SOURCE[t.source] ?? 'StrideLog', t.external_id ?? '', t.description ?? '',
    ]),
  ]
  return [{ title: 'Summary', rows: summary }, { title: 'Tasks', rows: taskRows }]
}
