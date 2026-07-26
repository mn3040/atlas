import { describe, expect, it } from 'vitest'
import { isBlankName, sanitizeName } from './textGuards'

describe('sanitizeName', () => {
  it('unescapes markdown backslash-escapes left over from docx/markdown imports', () => {
    expect(sanitizeName('Kyrgyzstan Itinerary \\(9/13\\-9/23\\)')).toBe('Kyrgyzstan Itinerary (9/13-9/23)')
  })

  it('strips HTML-looking tags', () => {
    expect(sanitizeName('<script>alert(1)</script>Bishkek')).toBe('alert(1)Bishkek')
  })

  it('strips control characters', () => {
    expect(sanitizeName('Osh\u0000Bazaar\u007F')).toBe('OshBazaar')
  })

  it('collapses whitespace and trims', () => {
    expect(sanitizeName('  Almaty    Trip  ')).toBe('Almaty Trip')
  })

  it('caps length', () => {
    expect(sanitizeName('a'.repeat(100), 10)).toBe('a'.repeat(10))
  })

  it('leaves an ordinary name untouched', () => {
    expect(sanitizeName('Reykjavik and South Coast')).toBe('Reykjavik and South Coast')
  })
})

describe('isBlankName', () => {
  it('treats whitespace-only input as blank', () => {
    expect(isBlankName('   ')).toBe(true)
  })

  it('treats a real name as not blank', () => {
    expect(isBlankName('Traveler')).toBe(false)
  })
})
