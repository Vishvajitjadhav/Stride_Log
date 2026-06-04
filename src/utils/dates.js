import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
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
      return { from: format(ref, 'yyyy-MM-dd'), to: format(ref, 'yyyy-MM-dd') }
    case 'weekly':
      return {
        from: format(startOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to:   format(endOfWeek(ref,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    case 'monthly':
      return {
        from: format(startOfMonth(ref), 'yyyy-MM-dd'),
        to:   format(endOfMonth(ref),   'yyyy-MM-dd'),
      }
    default:
      return { from: format(ref, 'yyyy-MM-dd'), to: format(ref, 'yyyy-MM-dd') }
  }
}

export function formatDisplay(dateStr) {
  return format(new Date(dateStr + 'T00:00:00'), 'dd MMM yyyy')
}
