import { describe, expect, it } from 'vitest'
import { buildItineraryPdf, cleanText } from './exportItinerary'
import type { Day, Item, Trip } from '../types/trip'

describe('cleanText', () => {
  it('returns an empty string for null/undefined', () => {
    expect(cleanText(null)).toBe('')
    expect(cleanText(undefined)).toBe('')
  })

  it('strips anchor tags down to their visible text', () => {
    expect(cleanText('<a href="https://evil.example.com">Blue Mosque</a>')).toBe('Blue Mosque')
  })

  it('strips other HTML tags entirely', () => {
    expect(cleanText('<b>Grand Bazaar</b> <script>alert(1)</script>')).toBe('Grand Bazaar alert(1)')
  })

  it('converts markdown links to their visible label', () => {
    expect(cleanText('[Topkapi Palace](https://maps.example.com/x)')).toBe('Topkapi Palace')
  })

  it('strips diacritics to their base ASCII letters', () => {
    expect(cleanText('Café Résumé')).toBe('Cafe Resume')
  })

  it('replaces remaining non-ASCII characters with a dash', () => {
    expect(cleanText('北京')).toBe('--')
  })

  it('collapses repeated internal spaces and trims the ends', () => {
    expect(cleanText('  Grand   Bazaar tour  ')).toBe('Grand Bazaar tour')
  })

  it('replaces newlines/tabs with a dash rather than treating them as collapsible whitespace', () => {
    // Non-printable ASCII (below 0x20) is caught by the same replace-with-dash step
    // as non-ASCII characters, which runs before whitespace collapsing.
    expect(cleanText('Grand Bazaar\ntour')).toBe('Grand Bazaar-tour')
  })

  it('is idempotent-safe against unterminated markup (does not throw)', () => {
    expect(() => cleanText('<a href="https://x.com">Broken link')).not.toThrow()
  })
})

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    ownerId: 'user-1',
    name: 'Kyrgyzstan <script>alert(1)</script>',
    description: null,
    countryCode: 'KG',
    visibility: 'personal',
    memberLimit: null,
    archivedAt: null,
    startDate: '2026-03-01',
    endDate: '2026-03-03',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDay(overrides: Partial<Day> & { id: string }): Day {
  return { tripId: 'trip-1', date: '2026-03-01', label: null, ...overrides }
}

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    tripId: 'trip-1',
    dayId: 'day-1',
    type: 'activity',
    category: 'attraction',
    name: 'Osh Bazaar',
    notes: null,
    lat: 0,
    lng: 0,
    locationLabel: null,
    countryCode: null,
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-03-01',
    endDate: null,
    startTime: null,
    endTime: null,
    flightNumber: null,
    priceLabel: null,
    photoUrl: null,
    googlePlaceId: null,
    googleMapsUrl: null,
    googleRating: null,
    googleUserRatingsTotal: null,
    roomType: null,
    guests: null,
    nightlyRate: null,
    taxesFees: null,
    confirmationNumber: null,
    rating: null,
    position: 0,
    ...overrides,
  }
}

describe('buildItineraryPdf', () => {
  it('produces a well-formed PDF byte stream', () => {
    const trip = makeTrip()
    const days = [makeDay({ id: 'day-1', date: '2026-03-01' })]
    const items = [makeItem({ id: 'item-1' })]

    const pdf = buildItineraryPdf(trip, days, items)
    const text = new TextDecoder().decode(pdf)

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trim().endsWith('%%EOF')).toBe(true)
  })

  it('sanitizes HTML out of the trip name before it reaches the PDF stream', () => {
    const trip = makeTrip({ name: '<b>Kyrgyzstan</b> <script>alert(1)</script>' })
    const pdf = buildItineraryPdf(trip, [], [])
    const text = new TextDecoder().decode(pdf)

    expect(text).not.toContain('<script>')
    expect(text).not.toContain('<b>')
  })

  it('does not throw when there are no days or items', () => {
    expect(() => buildItineraryPdf(makeTrip(), [], [])).not.toThrow()
  })

  it('renders a booking-relevant field (confirmation number) into the stream for a stay', () => {
    const trip = makeTrip()
    const days = [makeDay({ id: 'day-1' })]
    const items = [makeItem({ id: 'stay-1', type: 'stay', name: 'Grand Hotel', confirmationNumber: 'ABC1234' })]

    const pdf = buildItineraryPdf(trip, days, items)
    const text = new TextDecoder().decode(pdf)
    expect(text).toContain('ABC1234')
  })

  it('paginates when there are enough days to exceed a single page', () => {
    const trip = makeTrip()
    const days = Array.from({ length: 40 }, (_, i) => makeDay({ id: `day-${i}`, date: `2026-04-${String(i + 1).padStart(2, '0')}` }))
    const items = days.map((day) => makeItem({ id: `item-${day.id}`, dayId: day.id, name: `Activity for ${day.id}` }))

    const pdf = buildItineraryPdf(trip, days, items)
    const text = new TextDecoder().decode(pdf)
    const pageCount = (text.match(/\/Type \/Page(?!s)/g) ?? []).length
    expect(pageCount).toBeGreaterThan(1)
  })
})
