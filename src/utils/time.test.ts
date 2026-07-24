import { describe, expect, it } from 'vitest'
import { formatTime } from './time'

describe('formatTime', () => {
  it('returns an empty string for null/undefined/empty input', () => {
    expect(formatTime(null)).toBe('')
    expect(formatTime(undefined)).toBe('')
    expect(formatTime('')).toBe('')
  })

  it('formats midnight as 12:00 AM', () => {
    expect(formatTime('00:00:00')).toBe('12:00 AM')
    expect(formatTime('00:05')).toBe('12:05 AM')
  })

  it('formats noon as 12:00 PM', () => {
    expect(formatTime('12:00:00')).toBe('12:00 PM')
  })

  it('formats morning hours as AM', () => {
    expect(formatTime('09:00:00')).toBe('9:00 AM')
  })

  it('formats afternoon/evening hours as PM', () => {
    expect(formatTime('13:30:00')).toBe('1:30 PM')
    expect(formatTime('23:59:00')).toBe('11:59 PM')
  })

  it('pads single-digit minutes', () => {
    expect(formatTime('9:05:00')).toBe('9:05 AM')
  })
})
