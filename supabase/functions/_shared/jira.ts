// Pure rules for mirroring Jira issues as StrideLog tasks.
// No Deno or network APIs here, so it is unit tested from src/test.
//
// One task per issue per person. While an issue is open its task sits on
// "today" (so it stays in My Day and counts in the current period); when the
// issue is resolved the task moves to the resolution date and is Done.

export type JiraIssue = {
  id: string
  key: string
  fields: {
    summary?: string
    status: { name: string; statusCategory: { key: 'new' | 'indeterminate' | 'done' | string } }
    duedate?: string | null
    resolutiondate?: string | null
    project?: { key: string; name: string }
    issuetype?: { name: string }
  }
}

export type ExistingJiraTask = {
  id: string; external_id: string; title: string; date: string; status: string
  description: string | null; due_date: string | null; project_id: string | null
}

export function statusFor(issue: JiraIssue) {
  const s = issue.fields.status
  if (/block|impediment|on hold/i.test(s.name)) return 'blocked'
  if (s.statusCategory.key === 'done') return 'done'
  if (s.statusCategory.key === 'indeterminate') return 'in_progress'
  return 'pending'
}

export function categoryForIssue(issue: JiraIssue) {
  const t = `${issue.fields.issuetype?.name ?? ''}`.toLowerCase()
  if (/test|qa/.test(t)) return 'Testing'
  if (/design|ux|ui/.test(t)) return 'Design'
  if (/doc/.test(t)) return 'Documentation'
  if (/research|spike/.test(t)) return 'Research'
  if (/support|incident/.test(t)) return 'Support'
  return 'Development'
}

const localDate = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

export function planJira(
  issues: JiraIssue[],
  existing: ExistingJiraTask[],
  opts: { today: string; tz: string; site: string; projectIds: Map<string, string> },
) {
  const byKey = new Map(existing.map(t => [t.external_id, t]))
  const seen = new Set<string>()
  const inserts: Array<Record<string, unknown>> = []
  const updates: Array<{ id: string; fields: Record<string, unknown> }> = []

  for (const issue of issues) {
    seen.add(issue.key)
    const status = statusFor(issue)
    const done = status === 'done'
    const date = done && issue.fields.resolutiondate ? localDate(issue.fields.resolutiondate, opts.tz) : opts.today
    const title = `${issue.key} ${issue.fields.summary ?? ''}`.trim().slice(0, 200)
    const description = `Jira: ${issue.fields.status.name}${issue.fields.project ? `, ${issue.fields.project.name}` : ''}`
    const projectId = issue.fields.project
      ? opts.projectIds.get(issue.fields.project.name.toLowerCase()) ?? opts.projectIds.get(issue.fields.project.key.toLowerCase()) ?? null
      : null
    const want: Record<string, unknown> = {
      title, status, description, date,
      due_date: issue.fields.duedate ?? null,
      completed_on: done ? date : null,
      project_id: projectId,
    }

    const prev = byKey.get(issue.key)
    if (!prev) {
      inserts.push({ ...want, external_id: issue.key, external_url: `${opts.site.replace(/\/$/, '')}/browse/${issue.key}`, categoryName: categoryForIssue(issue) })
      continue
    }
    const fields: Record<string, unknown> = {}
    for (const k of ['title', 'status', 'description', 'date', 'due_date', 'project_id'] as const) {
      if ((prev[k] ?? null) !== (want[k] ?? null)) fields[k] = want[k]
    }
    if (fields.status !== undefined || fields.date !== undefined) fields.completed_on = want.completed_on
    if (Object.keys(fields).length) updates.push({ id: prev.id, fields })
  }

  // Issues no longer assigned to this person: drop open mirrors, keep finished history.
  const deletes = existing.filter(t => !seen.has(t.external_id) && t.status !== 'done').map(t => t.id)
  return { inserts, updates, deletes }
}

// Sample issues for local testing without Jira (JIRA_SYNC_MOCK=true).
export function mockIssues(email: string, today: string): JiraIssue[] {
  const n = [...email].reduce((a, c) => a + c.charCodeAt(0), 0) % 90 + 10
  const issue = (i: number, summary: string, status: string, cat: string, type = 'Story', resolved = false): JiraIssue => ({
    id: `${n}${i}`, key: `APP-${n}${i}`,
    fields: {
      summary, status: { name: status, statusCategory: { key: cat } },
      duedate: null, resolutiondate: resolved ? `${today}T09:00:00.000+0000` : null,
      project: { key: 'APP', name: 'Mobile App' }, issuetype: { name: type },
    },
  })
  return [
    issue(1, 'Login screen validation', 'In Progress', 'indeterminate'),
    issue(2, 'Push notification settings', 'In Review', 'indeterminate'),
    issue(3, 'Crash on profile save', 'To Do', 'new', 'Bug'),
    issue(4, 'Offline mode for tasks', 'Done', 'done', 'Story', true),
  ]
}
