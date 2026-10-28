import { describe, it, expect } from 'vitest'
import { planJira, statusFor, categoryForIssue, assignIssues, unownedRows } from '../../../supabase/functions/_shared/jira.ts'

const issue = (key, status, cat, extra = {}) => ({
  id: key, key,
  fields: {
    summary: `Summary ${key}`, status: { name: status, statusCategory: { key: cat } },
    duedate: null, resolutiondate: null, project: { key: 'APP', name: 'Mobile App' }, issuetype: { name: 'Story' }, ...extra,
  },
})
const opts = { today: '2026-10-12', tz: 'Asia/Kolkata', site: 'https://acme.atlassian.net/', projectIds: new Map([['mobile app', 'p1']]) }

describe('statusFor / categoryForIssue', () => {
  it('maps Jira status categories to StrideLog statuses', () => {
    expect(statusFor(issue('A-1', 'To Do', 'new'))).toBe('pending')
    expect(statusFor(issue('A-2', 'In Progress', 'indeterminate'))).toBe('in_progress')
    expect(statusFor(issue('A-5', 'In Review', 'indeterminate'))).toBe('in_review')
    expect(statusFor(issue('A-6', 'Ready for QA', 'indeterminate'))).toBe('in_review')
    expect(statusFor(issue('A-3', 'Blocked', 'indeterminate'))).toBe('blocked')
    expect(statusFor(issue('A-4', 'Done', 'done'))).toBe('done')
  })
  it('picks a category from the issue type', () => {
    expect(categoryForIssue(issue('A-1', 'To Do', 'new', { issuetype: { name: 'Bug' } }))).toBe('Development')
    expect(categoryForIssue(issue('A-1', 'To Do', 'new', { issuetype: { name: 'QA Task' } }))).toBe('Testing')
  })
})

describe('planJira', () => {
  it('creates tasks on today for open issues and on the resolution date for done ones', () => {
    const plan = planJira([
      issue('APP-1', 'In Review', 'indeterminate', { duedate: '2026-10-15' }),
      issue('APP-2', 'Done', 'done', { resolutiondate: '2026-10-10T20:00:00.000+0000' }),
    ], [], opts)
    expect(plan.inserts).toEqual([
      expect.objectContaining({ external_id: 'APP-1', title: 'APP-1 Summary APP-1', status: 'in_review', date: '2026-10-12',
        due_date: '2026-10-15', project_id: 'p1', description: 'Jira: In Review, Mobile App', external_url: 'https://acme.atlassian.net/browse/APP-1' }),
      // 20:00 UTC on the 10th is the 11th in India
      expect.objectContaining({ external_id: 'APP-2', status: 'done', date: '2026-10-11', completed_on: '2026-10-11' }),
    ])
  })

  it('follows status changes, moves open work to today, drops unassigned open issues and keeps finished history', () => {
    const existing = [
      { id: 't1', external_id: 'APP-1', title: 'APP-1 Summary APP-1', date: '2026-10-09', status: 'pending', description: 'Jira: To Do, Mobile App', due_date: null, project_id: 'p1' },
      { id: 't2', external_id: 'APP-9', title: 'APP-9 Old', date: '2026-10-09', status: 'in_progress', description: null, due_date: null, project_id: null },
      { id: 't3', external_id: 'APP-8', title: 'APP-8 Old', date: '2026-10-08', status: 'done', description: null, due_date: null, project_id: null },
    ]
    const plan = planJira([issue('APP-1', 'In Progress', 'indeterminate')], existing, opts)
    expect(plan.inserts).toEqual([])
    expect(plan.updates).toEqual([{ id: 't1', fields: { status: 'in_progress', description: 'Jira: In Progress, Mobile App', date: '2026-10-12', completed_on: null } }])
    expect(plan.deletes).toEqual(['t2'])
  })
})

describe('assignIssues / unownedRows (company Jira)', () => {
  const people = [
    { id: 'u1', email: 'arjun@acme.com', name: 'Arjun Rao', jira_account_id: 'acc-1' },
    { id: 'u2', email: 'sara@acme.com', name: 'Sara Khan', jira_account_id: null },
    { id: 'u3', email: 'liam@acme.com', name: 'Liam Patel', jira_account_id: null },
  ]
  const withAssignee = (key, assignee) => issue(key, 'In Progress', 'indeterminate', { assignee })

  it('matches by linked account, then email, then name; the rest is unowned', () => {
    const { owned, unowned, newLinks } = assignIssues([
      withAssignee('APP-1', { accountId: 'acc-1', displayName: 'Someone Else' }),
      withAssignee('APP-2', { accountId: 'acc-2', emailAddress: 'SARA@acme.com' }),
      withAssignee('APP-3', { accountId: 'acc-3', displayName: 'liam patel ' }),
      withAssignee('APP-4', { accountId: 'acc-4', displayName: 'Contractor' }),
      withAssignee('APP-5', null),
    ], people)
    expect(owned.get('u1').map(i => i.key)).toEqual(['APP-1'])
    expect(owned.get('u2').map(i => i.key)).toEqual(['APP-2'])
    expect(owned.get('u3').map(i => i.key)).toEqual(['APP-3'])
    expect(unowned.map(i => i.key)).toEqual(['APP-4', 'APP-5'])
    expect([...newLinks]).toEqual([['u2', 'acc-2'], ['u3', 'acc-3']])
  })

  it('every person gets an entry, so open tasks of someone with no issues left are cleared', () => {
    const { owned } = assignIssues([], people)
    expect([...owned.keys()]).toEqual(['u1', 'u2', 'u3'])
  })

  it('builds board rows for unowned issues', () => {
    const rows = unownedRows([issue('APP-9', 'Ready for QA', 'indeterminate', { assignee: { accountId: 'x', displayName: 'Contractor' }, updated: '2026-10-01T10:00:00.000+0000' })],
      { site: 'https://acme.atlassian.net/', projectIds: new Map([['mobile app', 'p1']]) })
    expect(rows).toEqual([expect.objectContaining({
      key: 'APP-9', status: 'in_review', status_name: 'Ready for QA', project_id: 'p1', assignee_name: 'Contractor',
      url: 'https://acme.atlassian.net/browse/APP-9', updated_at: '2026-10-01T10:00:00.000+0000',
    })])
  })
})
