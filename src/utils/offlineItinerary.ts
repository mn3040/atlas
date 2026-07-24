import type { Day, Item, Trip } from '../types/trip'

const KEY_PREFIX = 'atlas:offline-trip:'

export interface OfflineTripSnapshot {
  trip: Trip
  days: Day[]
  items: Item[]
  savedAt: string
}

export function saveOfflineTrip(tripId: string, data: { trip: Trip; days: Day[]; items: Item[] }): void {
  try {
    const snapshot: OfflineTripSnapshot = { ...data, savedAt: new Date().toISOString() }
    window.localStorage.setItem(`${KEY_PREFIX}${tripId}`, JSON.stringify(snapshot))
  } catch {
    // Storage can be full or unavailable (private browsing) -- offline
    // support degrades gracefully to "no cached copy" in that case.
  }
}

export function loadOfflineTrip(tripId: string): OfflineTripSnapshot | null {
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${tripId}`)
    if (!raw) return null
    return JSON.parse(raw) as OfflineTripSnapshot
  } catch {
    return null
  }
}
