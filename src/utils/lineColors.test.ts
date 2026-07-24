import { describe, expect, it } from 'vitest'
import { LINE_COLORS, lineColorForIndex, textColorForLine } from './lineColors'

describe('lineColorForIndex', () => {
  it('returns the color at the given index', () => {
    expect(lineColorForIndex(0)).toBe(LINE_COLORS[0])
    expect(lineColorForIndex(2)).toBe(LINE_COLORS[2])
  })

  it('wraps around once the index exceeds the palette length', () => {
    expect(lineColorForIndex(LINE_COLORS.length)).toBe(LINE_COLORS[0])
    expect(lineColorForIndex(LINE_COLORS.length + 1)).toBe(LINE_COLORS[1])
  })
})

describe('textColorForLine', () => {
  it('returns light text for the two dark background colors', () => {
    expect(textColorForLine('#083740')).toBe('#fefefe')
    expect(textColorForLine('#070606')).toBe('#fefefe')
  })

  it('returns dark text for the lighter background colors', () => {
    expect(textColorForLine('#22dd85')).toBe('#070606')
    expect(textColorForLine('#f7ff88')).toBe('#070606')
    expect(textColorForLine('#fefefe')).toBe('#070606')
  })

  it('is case-insensitive', () => {
    expect(textColorForLine('#083740'.toUpperCase())).toBe('#fefefe')
  })
})
