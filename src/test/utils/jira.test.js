import { describe, it, expect } from 'vitest'
import { planJira, statusFor, categoryForIssue } from '../../../supabase/functions/_shared/jira.ts'

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
