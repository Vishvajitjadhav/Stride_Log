import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter,
  endOfQuarter, subDays, subWeeks, subMonths, addDays, differenceInCalendarDays,
  eachDayOfInterval, isWeekend,
} from 'date-fns'

const ISO = 'yyyy-MM-dd'
const WEEK = { weekStartsOn: 1 }

export const toISO = d => format(d, ISO)

export function todayISO() {
  return format(new Date(), ISO)
}

// Local-calendar date N days ago. (Date#toISOString is UTC, which is the
// previous day for IST users before 05:30.)
export function daysAgoISO(n, ref = new Date()) {
  return format(subDays(ref, n), ISO)
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getDateRange(filter, ref = new Date()) {
  switch (filter) {
    case 'daily':
      return { from: toISO(ref), to: toISO(ref) }
    case 'weekly':
      return { from: toISO(startOfWeek(ref, WEEK)), to: toISO(endOfWeek(ref, WEEK)) }
    case 'monthly':
      return { from: toISO(startOfMonth(ref)), to: toISO(endOfMonth(ref)) }
    default:
      return { from: toISO(ref), to: toISO(ref) }
  }
}

// Named ranges used by the dashboards' filter bar.
export const PRESETS = [
  { key: 'this_week',    label: 'This week' },
  { key: 'last_week',    label: 'Last week' },
  { key: 'this_month',   label: 'This month' },
  { key: 'last_month',   label: 'Last month' },
  { key: 'custom',       label: 'Custom' },
]

export function presetRange(key, ref = new Date()) {
  switch (key) {
    case 'this_week':    return { from: toISO(startOfWeek(ref, WEEK)), to: toISO(endOfWeek(ref, WEEK)) }
    case 'last_week': {
      const d = subWeeks(ref, 1)
      return { from: toISO(startOfWeek(d, WEEK)), to: toISO(endOfWeek(d, WEEK)) }
    }
    case 'this_month':   return { from: toISO(startOfMonth(ref)), to: toISO(endOfMonth(ref)) }
    case 'last_month': {
      const d = subMonths(ref, 1)
      return { from: toISO(startOfMonth(d)), to: toISO(endOfMonth(d)) }
    }
    case 'this_quarter': return { from: toISO(startOfQuarter(ref)), to: toISO(endOfQuarter(ref)) }
    default:             return null
  }
}

// The equally long period immediately before {from, to} — for "vs previous".
export function previousRange({ from, to }) {
  const start = parseISO(from)
  const len = differenceInCalendarDays(parseISO(to), start) + 1
  return { from: toISO(subDays(start, len)), to: toISO(subDays(start, 1)) }
}

export function daysBetween(from, to) {
  if (!from || !to || from > to) return []
  return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map(toISO)
}

// Mon–Fri and not a company holiday. holidays: Set<isoDate>
export function isWorkingDay(iso, holidays = new Set()) {
  return !isWeekend(parseISO(iso)) && !holidays.has(iso)
}

export function workingDays(from, to, holidays = new Set()) {
  return daysBetween(from, to).filter(d => isWorkingDay(d, holidays))
}

export function addDaysISO(iso, n) {
  return toISO(addDays(parseISO(iso), n))
}

export function weekStartISO(iso) {
  return toISO(startOfWeek(parseISO(iso), WEEK))
}

export function formatDisplay(dateStr) {
  return format(new Date(dateStr + 'T00:00:00'), 'd MMM yyyy')
}

export function formatShort(dateStr) {
  return format(new Date(dateStr + 'T00:00:00'), 'EEE d MMM')
}

export function formatRange(from, to) {
  if (from === to) return formatDisplay(from)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const start = format(new Date(from + 'T00:00:00'), sameYear ? 'd MMM' : 'd MMM yyyy')
  return `${start} to ${format(new Date(to + 'T00:00:00'), 'd MMM yyyy')}`
}

export function formatLong(dateStr) {
  return format(new Date(dateStr + 'T00:00:00'), 'EEEE, d MMMM yyyy')
}

// 'week' | 'month' | 'period' — used in sentences like "compared with last week".
export function periodNoun(preset) {
  if (preset?.includes('week')) return 'week'
  if (preset?.includes('month')) return 'month'
  return 'period'
}
