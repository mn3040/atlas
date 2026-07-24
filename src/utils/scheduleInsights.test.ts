import { describe, expect, it } from 'vitest'
import { scheduleInsightsForItems } from './scheduleInsights'
import type { Item } from '../types/trip'

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    tripId: 'trip-1',
    dayId: null,
    type: 'activity',
    category: 'attraction',
    name: overrides.id,
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
    startTime: '09:00',
    endTime: '10:00',
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

describe('scheduleInsightsForItems', () => {
  it('returns no insights for fewer than two items', () => {
    const items = [makeItem({ id: 'a' })]
    expect(scheduleInsightsForItems(items, 'car')).toEqual([])
  })

  it('ignores stay items entirely', () => {
    const items = [
      makeItem({ id: 'a', type: 'stay', position: 0 }),
      makeItem({ id: 'b', type: 'stay', position: 1 }),
    ]
    expect(scheduleInsightsForItems(items, 'car')).toEqual([])
  })

  it('skips pairs that span different days', () => {
    const items = [
      makeItem({ id: 'a', position: 0, startDate: '2026-01-01', endTime: '10:00' }),
      makeItem({ id: 'b', position: 1, startDate: '2026-01-02', startTime: '09:00' }),
    ]
    expect(scheduleInsightsForItems(items, 'car')).toEqual([])
  })

  it('flags a time overlap when the next item starts before the current one ends', () => {
    const items = [
      makeItem({ id: 'a', name: 'Museum', position: 0, endTime: '11:00', lat: 0, lng: 0 }),
      makeItem({ id: 'b', name: 'Cafe', position: 1, startTime: '10:30', lat: 0.001, lng: 0.001 }),
    ]
    const insights = scheduleInsightsForItems(items, 'walk')
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toBe('Time overlap')
    expect(insights[0].itemId).toBe('b')
  })

  it('flags a tight transfer when the gap is positive but less than travel time plus buffer', () => {
    // ~1km apart, walking speed 4.5km/h => ~13 minutes travel, +15 buffer = ~28 min needed.
    const items = [
      makeItem({ id: 'a', position: 0, endTime: '10:00', lat: 0, lng: 0 }),
      makeItem({ id: 'b', position: 1, startTime: '10:10', lat: 0.009, lng: 0 }),
    ]
    const insights = scheduleInsightsForItems(items, 'walk')
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toBe('Tight transfer')
  })

  it('flags a long transfer when travel alone is 2+ hours and there is no timing conflict', () => {
    const items = [
      makeItem({ id: 'a', position: 0, endTime: '08:00', lat: 0, lng: 0 }),
      // Far enough by car (42km/h) to exceed 120 minutes, with an ample gap.
      makeItem({ id: 'b', position: 1, startTime: '20:00', lat: 1.3, lng: 0 }),
    ]
    const insights = scheduleInsightsForItems(items, 'car')
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toBe('Long transfer')
    expect(insights[0].tone).toBe('info')
  })

  it('reports the route as unavailable for the chosen mode instead of a time-based insight', () => {
    const items = [
      makeItem({ id: 'a', position: 0, endTime: '08:00', lat: 0, lng: 0 }),
      // Very short distance, so flight is not a practical mode.
      makeItem({ id: 'b', position: 1, startTime: '09:00', lat: 0.001, lng: 0.001 }),
    ]
    const insights = scheduleInsightsForItems(items, 'flight')
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toBe('Flight unavailable')
    expect(insights[0].tone).toBe('warn')
  })

  it('produces no insight when the gap comfortably exceeds travel time and travel is short', () => {
    const items = [
      makeItem({ id: 'a', position: 0, endTime: '08:00', lat: 0, lng: 0 }),
      makeItem({ id: 'b', position: 1, startTime: '09:00', lat: 0.001, lng: 0.001 }),
    ]
    expect(scheduleInsightsForItems(items, 'walk')).toEqual([])
  })

  it('sorts items by position before evaluating pairs, regardless of input order', () => {
    const items = [
      makeItem({ id: 'b', position: 1, startTime: '10:30', lat: 0.001, lng: 0.001 }),
      makeItem({ id: 'a', position: 0, endTime: '11:00', lat: 0, lng: 0 }),
    ]
    const insights = scheduleInsightsForItems(items, 'walk')
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toBe('Time overlap')
  })

  it('uses the flight arrival point (lat2/lng2) as the origin for the next leg', () => {
    const items = [
      makeItem({
        id: 'flight',
        type: 'flight',
        position: 0,
        lat: 0,
        lng: 0,
        lat2: 5,
        lng2: 5,
        endTime: '08:00',
      }),
      makeItem({ id: 'next', position: 1, startTime: '20:00', lat: 5.001, lng: 5.001 }),
    ]
    const insights = scheduleInsightsForItems(items, 'walk')
    // Arrival point is very close to the next stop, so no long-transfer/overlap insight should fire.
    expect(insights).toEqual([])
  })
})
