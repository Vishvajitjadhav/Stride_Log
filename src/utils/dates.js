import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter,
  endOfQuarter, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears, addDays, differenceInCalendarDays,
  eachDayOfInterval, isWeekend,
} from 'date-fns'

const ISO = 'yyyy-MM-dd'
const WEEK = { weekStartsOn: 1 }

export const toISO = d => format(d, ISO)

export function todayISO() {
  return format(new Date(), ISO)
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// Named ranges for report filters. compare: wording for "versus the previous period".
export const PRESETS = [
  { key: 'this_week',     label: 'This week',     compare: 'last week' },
  { key: 'last_week',     label: 'Last week',     compare: 'the week before' },
  { key: 'this_month',    label: 'This month',    compare: 'last month' },
  { key: 'last_month',    label: 'Last month',    compare: 'the month before' },
  { key: 'last_3_months', label: 'Last 3 months', compare: 'the 3 months before' },
  { key: 'last_6_months', label: 'Last 6 months', compare: 'the 6 months before' },
  { key: 'this_year',     label: 'This year',     compare: 'last year' },
  { key: 'last_year',     label: 'Last year',     compare: 'the year before' },
  { key: 'custom',        label: 'Custom dates',  compare: 'the previous period' },
]

export function compareLabel(preset) {
  return PRESETS.find(p => p.key === preset)?.compare ?? 'the previous period'
}

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
    // Rolling windows of whole months, ending with the current month.
    case 'last_3_months': return { from: toISO(startOfMonth(subMonths(ref, 2))), to: toISO(endOfMonth(ref)) }
    case 'last_6_months': return { from: toISO(startOfMonth(subMonths(ref, 5))), to: toISO(endOfMonth(ref)) }
    case 'this_quarter':  return { from: toISO(startOfQuarter(ref)), to: toISO(endOfQuarter(ref)) }
    case 'this_year':     return { from: toISO(startOfYear(ref)), to: toISO(endOfYear(ref)) }
    case 'last_year': {
      const d = subYears(ref, 1)
      return { from: toISO(startOfYear(d)), to: toISO(endOfYear(d)) }
    }
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


export const monthStartISO = iso => toISO(startOfMonth(parseISO(iso)))
export const monthEndISO = iso => toISO(endOfMonth(parseISO(iso)))
