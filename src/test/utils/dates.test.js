import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayISO, getGreeting, presetRange, compareLabel, toISO } from '../../utils/dates'

describe('getGreeting', () => {
  afterEach(() => vi.useRealTimers())

  it('returns Good morning before noon', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-04T08:00:00'))
    expect(getGreeting()).toBe('Good morning')
  })
  it('returns Good afternoon noon to 17:00', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-04T13:00:00'))
    expect(getGreeting()).toBe('Good afternoon')
  })
  it('returns Good evening after 17:00', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-04T19:00:00'))
    expect(getGreeting()).toBe('Good evening')
  })
})

describe('long periods', () => {
  const ref = new Date('2026-10-08T10:00:00')
  it('rolling month windows end with the current month', () => {
    expect(presetRange('last_3_months', ref)).toEqual({ from: '2026-08-01', to: '2026-10-31' })
    expect(presetRange('last_6_months', ref)).toEqual({ from: '2026-05-01', to: '2026-10-31' })
  })
  it('today', () => {
    expect(presetRange('today', ref)).toEqual({ from: toISO(ref), to: toISO(ref) })
    expect(compareLabel('today')).toBe('yesterday')
  })
  it('calendar years', () => {
    expect(presetRange('this_year', ref)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(presetRange('last_year', ref)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
  it('describes the comparison period in words', () => {
    expect(compareLabel('this_week')).toBe('last week')
    expect(compareLabel('last_6_months')).toBe('the 6 months before')
    expect(compareLabel('custom')).toBe('the previous period')
  })
})

describe('todayISO', () => {
  it('returns current date as YYYY-MM-DD', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(todayISO()).toBe('2026-06-04')
    vi.useRealTimers()
  })
})
