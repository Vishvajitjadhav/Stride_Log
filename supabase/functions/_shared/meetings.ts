// Pure rules for turning calendar meetings into StrideLog tasks.
// No Deno or network APIs here, so it is unit tested from src/test.

export type GraphEvent = {
  id: string
  subject?: string | null
  start: { dateTime: string }          // UTC (requested with Prefer: outlook.timezone="UTC")
  end: { dateTime: string }
  isAllDay?: boolean
  isCancelled?: boolean
  isOnlineMeeting?: boolean
  onlineMeetingProvider?: string
  showAs?: string
  sensitivity?: string
  responseStatus?: { response?: string }
}

export type ExistingTask = { id: string; external_id: string; title: string; date: string; status: string; description: string | null }

export type Meeting = { id: string; title: string; date: string; startsAt: Date; endsAt: Date; timeLabel: string; categoryName: string }

const utc = (s: string) => new Date(s.endsWith('Z') ? s : `${s}Z`)

// 'YYYY-MM-DD' of an instant in the company timezone.
export function localDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function localTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

// Pick a category from the meeting title; falls back to Team Meeting.
export function categoryFor(title: string) {
  const t = title.toLowerCase()
  if (/\b(stand ?up|scrum|daily sync|daily)\b/.test(t)) return 'Scrum Call'
  if (/\binterview/.test(t)) return 'Interview'
  if (/\b(client|customer|demo with)\b/.test(t)) return 'Client Call'
  if (/\bbrainstorm/.test(t)) return 'Brainstorming'
  if (/\b(training|workshop|learning)\b/.test(t)) return 'Training'
  return 'Team Meeting'
}

// Which calendar entries count as meetings worth logging.
export function meetingsFrom(events: GraphEvent[], { tz, dates, onlyOnline }: { tz: string; dates: string[]; onlyOnline: boolean }): Meeting[] {
  return events
    .filter(e => !e.isCancelled && !e.isAllDay)
    .filter(e => e.responseStatus?.response !== 'declined')
    .filter(e => e.showAs !== 'free')
    .filter(e => !onlyOnline || (e.isOnlineMeeting && (e.onlineMeetingProvider ?? 'teamsForBusiness') === 'teamsForBusiness'))
    .map(e => {
      const startsAt = utc(e.start.dateTime)
      const endsAt = utc(e.end.dateTime)
      const title = e.sensitivity === 'private' ? 'Private meeting' : (e.subject?.trim() || 'Meeting').slice(0, 200)
      return {
        id: e.id,
        title,
        date: localDate(startsAt, tz),
        startsAt,
        endsAt,
        timeLabel: `${localTime(startsAt, tz)} to ${localTime(endsAt, tz)}`,
        categoryName: categoryFor(title),
      }
    })
    .filter(m => dates.includes(m.date))
}

// Decide inserts / updates / deletes for one person.
// Meetings that have ended are Done; upcoming ones are To do. A task the
// person already finished is never reopened.
export function planSync(meetings: Meeting[], existing: ExistingTask[], now: Date) {
  const byId = new Map(existing.map(t => [t.external_id, t]))
  const seen = new Set<string>()
  const inserts: Array<Record<string, unknown>> = []
  const updates: Array<{ id: string; fields: Record<string, unknown> }> = []

  for (const m of meetings) {
    seen.add(m.id)
    const ended = m.endsAt <= now
    const description = `Teams meeting, ${m.timeLabel}`
    const prev = byId.get(m.id)
    if (!prev) {
      inserts.push({
        external_id: m.id, title: m.title, date: m.date, description, categoryName: m.categoryName,
        status: ended ? 'done' : 'pending', completed_on: ended ? m.date : null,
      })
      continue
    }
    const fields: Record<string, unknown> = {}
    if (prev.title !== m.title) fields.title = m.title
    if (prev.date !== m.date) fields.date = m.date
    if (prev.description !== description) fields.description = description
    if (ended && (prev.status === 'pending' || prev.status === 'in_progress')) {
      fields.status = 'done'
      fields.completed_on = m.date
    }
    if (Object.keys(fields).length) updates.push({ id: prev.id, fields })
  }

  // Meetings that were cancelled, declined or deleted since the last sync.
  const deletes = existing.filter(t => !seen.has(t.external_id)).map(t => t.id)
  return { inserts, updates, deletes }
}

// Fake meetings for local testing without Microsoft 365 (TEAMS_SYNC_MOCK=true).
export function mockEvents(email: string, dates: string[]): GraphEvent[] {
  const seed = [...email].reduce((n, c) => n + c.charCodeAt(0), 0)
  const plan = [
    ['Daily standup', '04:30', '04:45'],
    ['Sprint planning', '06:00', '07:00'],
    ['Client demo dry run', '09:30', '10:00'],
    ['Interview: frontend developer', '10:30', '11:15'],
    ['Design review', '11:30', '12:00'],
  ]
  return dates.flatMap((d, di) => plan
    .filter((_, i) => (i + seed + di) % 2 === 0 || i === 0)
    .map(([subject, s, e], i) => ({
      id: `mock-${email}-${d}-${i}`,
      subject,
      start: { dateTime: `${d}T${s}:00` },
      end: { dateTime: `${d}T${e}:00` },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      showAs: 'busy',
      responseStatus: { response: 'accepted' },
    })))
}
