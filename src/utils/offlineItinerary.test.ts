import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadOfflineTrip, saveOfflineTrip } from './offlineItinerary'
import type { Day, Item, Trip } from '../types/trip'

beforeEach(() => {
  window.localStorage.clear()
})

const trip: Trip = {
  id: 't1',
  ownerId: 'u1',
  name: 'Kazakhstan',
  description: null,
  countryCode: 'KZ',
  visibility: 'personal',
  memberLimit: null,
  archivedAt: null,
  startDate: '2026-08-01',
  endDate: '2026-08-05',
  createdAt: '2026-01-01T00:00:00Z',
}

const days: Day[] = [{ id: 'd1', tripId: 't1', date: '2026-08-01', label: null }]
const items: Item[] = []

describe('saveOfflineTrip / loadOfflineTrip', () => {
  it('round-trips a snapshot with a savedAt timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T03:04:05Z'))

    saveOfflineTrip('t1', { trip, days, items })
    const snapshot = loadOfflineTrip('t1')

    expect(snapshot).toEqual({ trip, days, items, savedAt: '2026-01-02T03:04:05.000Z' })
    vi.useRealTimers()
  })

  it('returns null when nothing is cached for that trip', () => {
    expect(loadOfflineTrip('missing-trip')).toBeNull()
  })

  it('scopes snapshots per trip id', () => {
    saveOfflineTrip('t1', { trip, days, items })
    expect(loadOfflineTrip('t2')).toBeNull()
  })

  it('returns null instead of throwing on corrupt stored JSON', () => {
    window.localStorage.setItem('atlas:offline-trip:t1', '{not valid json')
    expect(() => loadOfflineTrip('t1')).not.toThrow()
    expect(loadOfflineTrip('t1')).toBeNull()
  })
})
