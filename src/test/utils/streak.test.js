import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateStreak } from '../../utils/streak'

describe('calculateStreak', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns 0 for empty array', () => {
    vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(calculateStreak([])).toBe(0)
  })

  it('returns 1 when only today is logged', () => {
    vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(calculateStreak(['2026-06-04'])).toBe(1)
  })

  it('returns 0 when most recent is 2+ days ago', () => {
    vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(calculateStreak(['2026-06-02'])).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(calculateStreak(['2026-06-04', '2026-06-03', '2026-06-02'])).toBe(3)
  })

  it('stops at a gap', () => {
    vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(calculateStreak(['2026-06-04', '2026-06-03', '2026-06-01'])).toBe(2)
  })

  it('counts streak ending yesterday when today not yet logged', () => {
    vi.setSystemTime(new Date('2026-06-04T10:00:00'))
    expect(calculateStreak(['2026-06-03', '2026-06-02', '2026-06-01'])).toBe(3)
  })
})
