import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { todayISO, getDateRange, getGreeting } from '../../utils/dates'

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

describe('getDateRange', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-04T10:00:00')) })
  afterEach(() => vi.useRealTimers())

  it('daily returns today ISO', () => {
    expect(getDateRange('daily')).toEqual({ from: '2026-06-04', to: '2026-06-04' })
  })
  it('weekly returns Mon–Sun of current week', () => {
    const r = getDateRange('weekly')
    expect(r.from).toBe('2026-06-01')
    expect(r.to).toBe('2026-06-07')
  })
  it('monthly returns first and last day of month', () => {
    const r = getDateRange('monthly')
    expect(r.from).toBe('2026-06-01')
    expect(r.to).toBe('2026-06-30')
  })
})

describe('todayISO', () => {
  it('returns current date as YYYY-MM-DD', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(todayISO()).toBe('2026-06-04')
    vi.useRealTimers()
  })
})
