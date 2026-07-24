import { describe, expect, it } from 'vitest'
import { extractItineraryItems } from './importItinerary'
import type { Trip } from '../types/trip'

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    ownerId: 'user-1',
    name: 'Test Trip',
    description: null,
    countryCode: null,
    visibility: 'personal',
    memberLimit: null,
    archivedAt: null,
    startDate: '2026-03-01',
    endDate: '2026-03-10',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('extractItineraryItems - sanitization', () => {
  it('strips raw HTML tags out of item names instead of importing them verbatim', () => {
    const trip = makeTrip()
    const text = '⭐\n<b>Grand Bazaar</b>\nVisit the market in the morning'
    const items = extractItineraryItems(text, trip)
    const names = items.map((i) => i.name)
    expect(names.some((n) => n.includes('<b>') || n.includes('</b>'))).toBe(false)
  })

  it('strips script tags and their content is not injected as executable markup', () => {
    const trip = makeTrip()
    const text = '⭐\n<script>alert(1)</script> Old Town Square'
    const items = extractItineraryItems(text, trip)
    for (const item of items) {
      expect(item.name).not.toMatch(/<script/i)
      expect(item.notes).not.toMatch(/<script/i)
    }
  })

  it('converts markdown links to plain text and tags them as place links', () => {
    const trip = makeTrip()
    const text = '⭐\n[Blue Mosque](https://maps.example.com/blue-mosque)'
    const items = extractItineraryItems(text, trip)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].name).not.toContain('[')
    expect(items[0].name).not.toContain('http')
  })

  it('strips raw anchor tags with href attributes down to their visible text', () => {
    const trip = makeTrip()
    const text = '⭐\n<a href="https://evil.example.com/x">Topkapi Palace</a>'
    const items = extractItineraryItems(text, trip)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].name).toBe('Topkapi Palace')
    expect(items[0].name).not.toContain('href')
    expect(items[0].name).not.toContain('http')
  })

  it('decodes HTML entities before stripping tags', () => {
    const trip = makeTrip()
    const text = '⭐\nFish &amp; Chips Tour'
    const items = extractItineraryItems(text, trip)
    expect(items[0]?.name).not.toContain('&amp;')
  })

  it('strips bare URLs out of notes', () => {
    const trip = makeTrip()
    const text = '⭐\nGrand Bazaar https://example.com/bazaar great shopping'
    const items = extractItineraryItems(text, trip)
    expect(items[0]?.notes ?? '').not.toContain('http')
  })
})

describe('extractItineraryItems - flights', () => {
  it('extracts a flight with a flight number, times, and airport pair', () => {
    const trip = makeTrip()
    const text = 'Flight AA123 depart from JFK to CDG 9:00am 11:30pm'
    const items = extractItineraryItems(text, trip)
    const flight = items.find((i) => i.type === 'flight')
    expect(flight).toBeDefined()
    expect(flight?.flightNumber).toBe('AA123')
    expect(flight?.startTime).toBe('09:00')
  })

  it('falls back to a generic flight name when there is no flight number', () => {
    const trip = makeTrip()
    const text = 'Depart from JFK to CDG'
    const items = extractItineraryItems(text, trip)
    const flight = items.find((i) => i.type === 'flight')
    expect(flight?.name).toMatch(/Flight/)
  })
})

describe('extractItineraryItems - stays', () => {
  it('extracts a hotel stay with a confirmation number', () => {
    const trip = makeTrip()
    const text = 'Hotel: Grand Palace confirmation ABC1234'
    const items = extractItineraryItems(text, trip)
    const stay = items.find((i) => i.type === 'stay')
    expect(stay).toBeDefined()
    expect(stay?.confirmationNumber).toBe('ABC1234')
  })

  it('does not treat "2 hours stay" phrasing as a hotel stay', () => {
    const trip = makeTrip()
    const text = '⭐\n2 hours stay at the viewpoint'
    const items = extractItineraryItems(text, trip)
    expect(items.some((i) => i.type === 'stay')).toBe(false)
  })
})

describe('extractItineraryItems - dates', () => {
  it('assigns items to dates found in numeric date lines', () => {
    const trip = makeTrip({ startDate: '2026-03-01', endDate: '2026-03-10' })
    const text = '3/5\nGrand Bazaar tour in the morning'
    const items = extractItineraryItems(text, trip)
    expect(items[0]?.startDate).toBe('2026-03-05')
  })

  it('expands a date range header across multiple days', () => {
    const trip = makeTrip({ startDate: '2026-03-01', endDate: '2026-03-10' })
    const text = '3/5 - 3/6\nVisit the Blue Mosque\n- Topkapi Palace'
    const items = extractItineraryItems(text, trip)
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0].startDate >= '2026-03-05').toBe(true)
  })

  it('clamps dates outside the trip range to the trip boundaries', () => {
    const trip = makeTrip({ startDate: '2026-03-01', endDate: '2026-03-10' })
    const text = '1/1\nGrand Bazaar tour before the trip starts'
    const items = extractItineraryItems(text, trip)
    expect(items[0]?.startDate).toBe('2026-03-01')
  })
});

describe('extractItineraryItems - must-see markers', () => {
  it('marks the next place line as mustSee after a star marker line', () => {
    const trip = makeTrip()
    const text = '⭐\nHidden Gem Overlook'
    const items = extractItineraryItems(text, trip)
    expect(items.some((i) => i.mustSee)).toBe(true)
  })

  it('detects inline "must see" text as well as star emoji', () => {
    const trip = makeTrip()
    // Note: a " - " inside the line is treated as a label/prefix separator by the
    // parser (e.g. "9:00am - Activity"), so avoid a dash between the place and the note.
    const text = 'Grand Bazaar market must see today'
    const items = extractItineraryItems(text, trip)
    expect(items.find((i) => i.name.includes('Grand Bazaar'))?.mustSee).toBe(true)
  })
})

describe('extractItineraryItems - branches', () => {
  it('tags items under a known branch place with a branch label', () => {
    const trip = makeTrip()
    const text = 'Tajikistan\n⭐\nKarakul lake viewpoint'
    const items = extractItineraryItems(text, trip)
    expect(items.some((i) => i.branchLabel === 'Plan B: Tajik border detour')).toBe(true)
  })

  it('marks branch items with importRole "option"', () => {
    const trip = makeTrip()
    const text = 'Tajikistan\n⭐\nKarakul lake viewpoint'
    const items = extractItineraryItems(text, trip)
    const branchItem = items.find((i) => i.branchLabel)
    expect(branchItem?.importRole).toBe('option')
  })
})

describe('extractItineraryItems - de-duplication and limits', () => {
  it('removes exact duplicate suggestions (same type/name/date/time)', () => {
    const trip = makeTrip()
    const text = '⭐\nGrand Bazaar\n⭐\nGrand Bazaar'
    const items = extractItineraryItems(text, trip)
    const grandBazaarCount = items.filter((i) => i.name === 'Grand Bazaar').length
    expect(grandBazaarCount).toBeLessThanOrEqual(1)
  })

  it('caps the number of suggestions at 40', () => {
    const trip = makeTrip({ startDate: '2026-01-01', endDate: '2026-12-31' })
    const lines = Array.from({ length: 60 }, (_, i) => `⭐\nUnique Place Number ${i}`).join('\n')
    const items = extractItineraryItems(lines, trip)
    expect(items.length).toBeLessThanOrEqual(40)
  })
})

describe('extractItineraryItems - malformed input safety', () => {
  it('does not throw on empty input', () => {
    expect(() => extractItineraryItems('', makeTrip())).not.toThrow()
    expect(extractItineraryItems('', makeTrip())).toEqual([])
  })

  it('does not throw on unterminated HTML/markdown', () => {
    const trip = makeTrip()
    expect(() => extractItineraryItems('<a href="https://x.com">Broken link\n[Also broken(', trip)).not.toThrow()
  })

  it('does not throw on extremely long single lines', () => {
    const trip = makeTrip()
    const longLine = `⭐\n${'A'.repeat(5000)}`
    expect(() => extractItineraryItems(longLine, trip)).not.toThrow()
  })
})
