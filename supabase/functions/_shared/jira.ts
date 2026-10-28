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
    assignee?: { accountId: string; emailAddress?: string | null; displayName?: string | null } | null
    updated?: string | null
  }
}

export type ExistingJiraTask = {
  id: string; external_id: string; title: string; date: string; status: string
  description: string | null; due_date: string | null; project_id: string | null
  external_updated_at?: string | null
}

export function statusFor(issue: JiraIssue) {
  const s = issue.fields.status
  if (/block|impediment|on hold/i.test(s.name)) return 'blocked'
  if (s.statusCategory.key === 'done') return 'done'
  if (/review|\bqa\b|testing|verif/i.test(s.name)) return 'in_review'
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
      external_updated_at: issue.fields.updated ?? null,
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
    if (want.external_updated_at && Date.parse(String(want.external_updated_at)) !== Date.parse(String(prev.external_updated_at ?? ''))) {
      fields.external_updated_at = want.external_updated_at
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

// ── Company wide sync ───────────────────────────────────────────────────────

export type Person = { id: string; email: string; name: string; jira_account_id: string | null }

// Who owns each issue: the StrideLog person linked to the Jira account, else
// the one with the same email, else the one with the same name. Issues with
// no assignee, or an assignee who is not in StrideLog, are "unowned".
// newLinks: Jira accounts matched by email or name, to remember on the profile.
export function assignIssues(issues: JiraIssue[], people: Person[]) {
  const byAccount = new Map(people.filter(p => p.jira_account_id).map(p => [p.jira_account_id!, p]))
  const byEmail = new Map(people.map(p => [p.email.toLowerCase(), p]))
  const byName = new Map(people.map(p => [p.name.trim().toLowerCase(), p]))
  const owned = new Map<string, JiraIssue[]>(people.map(p => [p.id, []]))
  const unowned: JiraIssue[] = []
  const newLinks = new Map<string, string>()   // person id -> Jira account id

  for (const issue of issues) {
    const a = issue.fields.assignee
    if (!a) { unowned.push(issue); continue }
    const person = byAccount.get(a.accountId)
      ?? (a.emailAddress ? byEmail.get(a.emailAddress.toLowerCase()) : undefined)
      ?? (a.displayName ? byName.get(a.displayName.trim().toLowerCase()) : undefined)
    if (!person) { unowned.push(issue); continue }
    if (person.jira_account_id !== a.accountId) newLinks.set(person.id, a.accountId)
    owned.get(person.id)!.push(issue)
  }
  return { owned, unowned, newLinks }
}

// jira_issues rows for unowned issues.
export function unownedRows(issues: JiraIssue[], opts: { site: string; projectIds: Map<string, string> }) {
  return issues.map(issue => ({
    key: issue.key,
    title: (issue.fields.summary ?? issue.key).slice(0, 200),
    status: statusFor(issue),
    status_name: issue.fields.status.name,
    jira_project: issue.fields.project?.name ?? null,
    project_id: issue.fields.project
      ? opts.projectIds.get(issue.fields.project.name.toLowerCase()) ?? opts.projectIds.get(issue.fields.project.key.toLowerCase()) ?? null
      : null,
    assignee_name: issue.fields.assignee?.displayName ?? null,
    url: `${opts.site.replace(/\/$/, '')}/browse/${issue.key}`,
    due_date: issue.fields.duedate ?? null,
    updated_at: issue.fields.updated ?? null,
  }))
}

// Sample company issues for local testing (JIRA_SYNC_MOCK=true): a few for
// each person plus some nobody owns.
export function mockCompanyIssues(people: Person[], today: string, keys: string[]): JiraIssue[] {
  const key = keys[0] ?? 'APP'
  const out: JiraIssue[] = []
  const statuses: Array<[string, string]> = [['To Do', 'new'], ['In Progress', 'indeterminate'], ['In Review', 'indeterminate'], ['Done', 'done']]
  let n = 100
  people.forEach((p, i) => {
    statuses.slice(0, 2 + (i % 3)).forEach(([name, cat], j) => {
      n++
      out.push({
        id: String(n), key: `${key}-${n}`,
        fields: {
          summary: `Sample work ${n}`, status: { name, statusCategory: { key: cat } },
          duedate: null, resolutiondate: cat === 'done' ? `${today}T09:00:00.000+0000` : null,
          project: { key, name: key }, issuetype: { name: 'Story' },
          assignee: { accountId: `mock-${p.id}`, emailAddress: p.email, displayName: p.name },
          updated: new Date(Date.parse(`${today}T09:00:00Z`) - (j + i) * 2 * 86_400_000).toISOString(),
        },
      })
    })
  })
  ;['Set up error alerts', 'Update app store screenshots', 'Review API rate limits'].forEach((summary, i) => {
    n++
    out.push({
      id: String(n), key: `${key}-${n}`,
      fields: {
        summary, status: { name: i === 2 ? 'In Progress' : 'To Do', statusCategory: { key: i === 2 ? 'indeterminate' : 'new' } },
        duedate: null, resolutiondate: null, project: { key, name: key }, issuetype: { name: 'Task' },
        assignee: i === 2 ? { accountId: 'outside-1', displayName: 'Contractor' } : null,
        updated: `${today}T08:00:00.000+0000`,
      },
    })
  })
  return out
}
