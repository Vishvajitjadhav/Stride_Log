import { describe, it, expect } from 'vitest'
import { getInitials } from '../../utils/initials'

describe('getInitials', () => {
  it('returns initials from two-word name', () => {
    expect(getInitials('Vishvajit Jadhav')).toBe('VJ')
  })
  it('returns single letter for one-word name', () => {
    expect(getInitials('Rahul')).toBe('R')
  })
  it('uses first two words only for three-word name', () => {
    expect(getInitials('Vishvajit Kumar Jadhav')).toBe('VK')
  })
  it('returns ?? for empty string', () => {
    expect(getInitials('')).toBe('??')
  })
  it('returns ?? for null', () => {
    expect(getInitials(null)).toBe('??')
  })
})
