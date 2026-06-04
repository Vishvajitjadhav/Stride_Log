import { parseISO, differenceInCalendarDays, isToday, isYesterday } from 'date-fns'

export function calculateStreak(submittedDates) {
  if (!submittedDates.length) return 0

  const sorted = [...submittedDates]
    .map(d => parseISO(d))
    .sort((a, b) => b - a)

  const mostRecent = sorted[0]
  if (!isToday(mostRecent) && !isYesterday(mostRecent)) return 0

  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    if (differenceInCalendarDays(sorted[i - 1], sorted[i]) === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}
