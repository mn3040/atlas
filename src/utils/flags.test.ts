import { describe, expect, it } from 'vitest'
import { countryCodesForTrip, normalizeCountryCode } from './flags'
import type { Item, Trip } from '../types/trip'

describe('normalizeCountryCode', () => {
  it('uppercases a valid lowercase code', () => {
    expect(normalizeCountryCode('jp')).toBe('JP')
  })

  it('accepts an already-uppercase code', () => {
    expect(normalizeCountryCode('KG')).toBe('KG')
  })

  it('returns null for null/undefined/empty input', () => {
    expect(normalizeCountryCode(null)).toBeNull()
    expect(normalizeCountryCode(undefined)).toBeNull()
    expect(normalizeCountryCode('')).toBeNull()
  })

  it('returns null for codes that are not exactly two letters', () => {
    expect(normalizeCountryCode('USA')).toBeNull()
    expect(normalizeCountryCode('U')).toBeNull()
  })

  it('returns null for two characters that are not both letters', () => {
    expect(normalizeCountryCode('1J')).toBeNull()
  })

  it('trims whitespace before validating', () => {
    expect(normalizeCountryCode('  fr  ')).toBe('FR')
  })
})

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
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    tripId: 'trip-1',
    dayId: null,
    type: 'activity',
    category: 'attraction',
    name: 'Item',
    notes: null,
    lat: 0,
    lng: 0,
    locationLabel: null,
    countryCode: null,
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-01-01',
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

describe('countryCodesForTrip', () => {
  it('returns an empty array when there are no items and no trip country code', () => {
    expect(countryCodesForTrip(makeTrip(), [])).toEqual([])
  })

  it('orders codes by each item\'s startDate/position rather than array order', () => {
    const items = [
      makeItem({ id: '1', countryCode: 'FR', startDate: '2026-01-05', position: 0 }),
      makeItem({ id: '2', countryCode: 'JP', startDate: '2026-01-01', position: 0 }),
    ]
    expect(countryCodesForTrip(makeTrip(), items)).toEqual(['JP', 'FR'])
  })

  it('deduplicates repeated country codes across items', () => {
    const items = [
      makeItem({ id: '1', countryCode: 'FR', startDate: '2026-01-01' }),
      makeItem({ id: '2', countryCode: 'fr', startDate: '2026-01-02' }),
    ]
    expect(countryCodesForTrip(makeTrip(), items)).toEqual(['FR'])
  })

  it('ignores items with invalid country codes', () => {
    const items = [makeItem({ id: '1', countryCode: 'invalid' })]
    expect(countryCodesForTrip(makeTrip(), items)).toEqual([])
  })

  it('appends the trip-level country code as a fallback when not already present', () => {
    const trip = makeTrip({ countryCode: 'KG' })
    const items = [makeItem({ id: '1', countryCode: 'FR', startDate: '2026-01-01' })]
    expect(countryCodesForTrip(trip, items)).toEqual(['FR', 'KG'])
  })

  it('does not duplicate the trip country code if an item already has it', () => {
    const trip = makeTrip({ countryCode: 'FR' })
    const items = [makeItem({ id: '1', countryCode: 'FR', startDate: '2026-01-01' })]
    expect(countryCodesForTrip(trip, items)).toEqual(['FR'])
  })

  it('defaults the items argument to an empty array', () => {
    const trip = makeTrip({ countryCode: 'KG' })
    expect(countryCodesForTrip(trip)).toEqual(['KG'])
  })
})
