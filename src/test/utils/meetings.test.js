import { describe, it, expect } from 'vitest'
import { meetingsFrom, planSync, categoryFor, localDate } from '../../../supabase/functions/_shared/meetings.ts'

const tz = 'Asia/Kolkata'
const ev = (o) => ({
  id: o.id, subject: o.subject ?? 'Weekly sync',
  start: { dateTime: o.start }, end: { dateTime: o.end },
  isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness', showAs: 'busy',
  responseStatus: { response: 'accepted' }, ...o.extra,
})

describe('categoryFor', () => {
  it('picks a category from the meeting title', () => {
    expect(categoryFor('Daily standup')).toBe('Scrum Call')
    expect(categoryFor('Interview: backend dev')).toBe('Interview')
    expect(categoryFor('Client demo')).toBe('Client Call')
    expect(categoryFor('Q4 brainstorming')).toBe('Brainstorming')
    expect(categoryFor('Weekly sync')).toBe('Team Meeting')
  })
})

describe('meetingsFrom', () => {
  const dates = ['2026-10-11', '2026-10-12']
  const events = [
    ev({ id: '1', subject: 'Daily standup', start: '2026-10-12T04:30:00', end: '2026-10-12T04:45:00' }),
    ev({ id: '2', start: '2026-10-12T06:00:00', end: '2026-10-12T07:00:00', extra: { isCancelled: true } }),
    ev({ id: '3', start: '2026-10-12T06:00:00', end: '2026-10-12T07:00:00', extra: { responseStatus: { response: 'declined' } } }),
    ev({ id: '4', start: '2026-10-12T00:00:00', end: '2026-10-13T00:00:00', extra: { isAllDay: true } }),
    ev({ id: '5', subject: 'Lunch', start: '2026-10-12T07:30:00', end: '2026-10-12T08:00:00', extra: { isOnlineMeeting: false } }),
    ev({ id: '6', subject: 'Salary talk', start: '2026-10-12T09:00:00', end: '2026-10-12T09:30:00', extra: { sensitivity: 'private' } }),
    // 20:00 UTC on the 12th is already the 13th in India: outside the window
    ev({ id: '7', start: '2026-10-12T20:00:00', end: '2026-10-12T20:30:00' }),
  ]

  it('keeps real Teams meetings in the window and converts to local date and time', () => {
    const m = meetingsFrom(events, { tz, dates, onlyOnline: true })
    expect(m.map(x => x.id)).toEqual(['1', '6'])
    expect(m[0]).toMatchObject({ title: 'Daily standup', date: '2026-10-12', timeLabel: '10:00 to 10:15', categoryName: 'Scrum Call' })
    expect(m[1].title).toBe('Private meeting')
  })

  it('includes non Teams calendar entries when the company allows it', () => {
    expect(meetingsFrom(events, { tz, dates, onlyOnline: false }).map(x => x.id)).toEqual(['1', '5', '6'])
  })

  it('localDate uses the company timezone', () => {
    expect(localDate(new Date('2026-10-12T20:00:00Z'), tz)).toBe('2026-10-13')
  })
})

describe('planSync', () => {
  const now = new Date('2026-10-12T06:30:00Z')
  const meeting = (o) => ({ id: o.id, title: o.title ?? 'Standup', date: '2026-10-12', categoryName: 'Scrum Call',
    startsAt: new Date(o.start), endsAt: new Date(o.end), timeLabel: '10:00 to 10:15' })

  it('creates tasks: finished meetings are Done, upcoming ones To do', () => {
    const plan = planSync([
      meeting({ id: 'a', start: '2026-10-12T04:30:00Z', end: '2026-10-12T04:45:00Z' }),
      meeting({ id: 'b', start: '2026-10-12T09:00:00Z', end: '2026-10-12T09:30:00Z' }),
    ], [], now)
    expect(plan.inserts.map(i => [i.external_id, i.status, i.completed_on])).toEqual([['a', 'done', '2026-10-12'], ['b', 'pending', null]])
    expect(plan.inserts[0].description).toBe('Teams meeting, 10:00 to 10:15')
  })

  it('updates changed meetings, completes ended ones, removes cancelled ones and never duplicates', () => {
    const existing = [
      { id: 't1', external_id: 'a', title: 'Old title', date: '2026-10-12', status: 'pending', description: 'Teams meeting, 10:00 to 10:15' },
      { id: 't2', external_id: 'gone', title: 'Cancelled', date: '2026-10-12', status: 'pending', description: null },
      { id: 't3', external_id: 'c', title: 'Standup', date: '2026-10-12', status: 'done', description: 'Teams meeting, 10:00 to 10:15' },
    ]
    const plan = planSync([
      meeting({ id: 'a', start: '2026-10-12T04:30:00Z', end: '2026-10-12T04:45:00Z' }),
      meeting({ id: 'c', start: '2026-10-12T09:00:00Z', end: '2026-10-12T09:30:00Z' }),
    ], existing, now)
    expect(plan.inserts).toEqual([])
    expect(plan.updates).toEqual([{ id: 't1', fields: { title: 'Standup', status: 'done', completed_on: '2026-10-12' } }])
    expect(plan.deletes).toEqual(['t2'])
  })
})
