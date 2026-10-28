// Pure rules for the Team board: which cards show, in which column, and
// which need attention. Cards come from tasks (v_task_facts rows) and from
// Jira issues nobody in StrideLog owns (jira_issues rows).

import { addDaysISO, workingDays } from './dates'

export const COLUMNS = [
  { key: 'pending', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'in_review', label: 'In review' },
  { key: 'done', label: 'Done' },
]
// Blocked work has started, so it sits with In progress and is flagged red.
export const columnOf = status => (status === 'blocked' ? 'in_progress' : COLUMNS.some(c => c.key === status) ? status : 'pending')

export const STUCK_DAYS = 5

// Working days (Mon to Fri, not holidays) since `iso` up to today, not
// counting the day itself.
export function workingDaysSince(iso, today, holidays = new Set()) {
  if (!iso || iso >= today) return 0
  return workingDays(addDaysISO(iso, 1), today, holidays).length
}

// Open work older than this is left off the board (long forgotten to dos).
const OPEN_WINDOW = 30

// -> cards: [{ id, kind: 'task' | 'issue', title, status, column, userId, assigneeName,
//              project, projectId, source, url, key, due, changedDays, stuck, overdue, blocked, task }]
//    Done cards only when finished inside { from, to }; open ones planned from 30 days before.
export function boardCards({ tasks = [], issues = [], from, to, today, holidays }) {
  const local = iso => (iso ? iso.slice(0, 10) : null)
  const card = (base, changed, status, due) => {
    const changedDays = workingDaysSince(local(changed), today, holidays)
    const open = status !== 'done'
    return {
      ...base,
      status,
      column: columnOf(status),
      due,
      changedDays,
      stuck: open && changedDays >= STUCK_DAYS,
      overdue: open && Boolean(due) && due < today,
      blocked: status === 'blocked',
    }
  }

  const fromTasks = tasks
    .filter(t => (t.status === 'done'
      ? (t.completed_on ?? t.date) >= from && (t.completed_on ?? t.date) <= to
      : t.date <= to && t.date >= addDaysISO(from, -OPEN_WINDOW)))
    .map(t => card({
      id: t.id, kind: 'task', title: t.title, userId: t.user_id, assigneeName: null, project: t.project, projectId: t.project_id,
      source: t.source ?? 'manual', url: t.external_url, key: t.external_id, task: t,
    }, t.changed_at, t.status, t.due_date))

  const fromIssues = issues
    .filter(i => i.status !== 'done' || (local(i.updated_at) >= from && local(i.updated_at) <= to))
    .map(i => card({
      id: `jira:${i.key}`, kind: 'issue', title: i.title, userId: null, assigneeName: i.assignee_name, project: i.jira_project,
      projectId: i.project_id, source: 'jira', url: i.url, key: i.key, statusName: i.status_name,
    }, i.updated_at, i.status, i.due_date))

  return [...fromTasks, ...fromIssues]
}

// Most urgent first: stuck and overdue, then oldest change.
export function sortCards(cards) {
  return [...cards].sort((a, b) =>
    Number(b.blocked) - Number(a.blocked) || Number(b.stuck || b.overdue) - Number(a.stuck || a.overdue) || b.changedDays - a.changedDays)
}
