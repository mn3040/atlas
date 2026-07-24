import { describe, expect, it } from 'vitest'
import { estimateTravel, formatDuration, haversineKm, routeAvailability } from './distance'

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 40.7, lng: -74 }, { lat: 40.7, lng: -74 })).toBe(0)
  })

  it('computes a known distance (NYC to LA) within tolerance', () => {
    const nyc = { lat: 40.7128, lng: -74.006 }
    const la = { lat: 34.0522, lng: -118.2437 }
    const km = haversineKm(nyc, la)
    expect(km).toBeGreaterThan(3900)
    expect(km).toBeLessThan(3950)
  })

  it('is symmetric', () => {
    const a = { lat: 51.5074, lng: -0.1278 }
    const b = { lat: 48.8566, lng: 2.3522 }
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10)
  })
})

describe('formatDuration', () => {
  it('formats sub-hour durations as minutes only', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(0)).toBe('0 min')
  })

  it('formats exactly 60 minutes as 1h 0m', () => {
    expect(formatDuration(60)).toBe('1h 0m')
  })

  it('formats multi-hour durations', () => {
    expect(formatDuration(125)).toBe('2h 5m')
  })
})

describe('estimateTravel', () => {
  it('never returns less than 3 minutes even for zero distance', () => {
    const point = { lat: 10, lng: 10 }
    const travel = estimateTravel(point, point, 'walk')
    expect(travel.minutes).toBe(3)
    expect(travel.km).toBe(0)
  })

  it('scales minutes inversely with speed for the same distance', () => {
    const a = { lat: 0, lng: 0 }
    const b = { lat: 0, lng: 1 }
    const walk = estimateTravel(a, b, 'walk')
    const flight = estimateTravel(a, b, 'flight')
    expect(flight.minutes).toBeLessThan(walk.minutes)
  })

  it('includes a mode-specific note', () => {
    const a = { lat: 0, lng: 0 }
    const b = { lat: 1, lng: 1 }
    expect(estimateTravel(a, b, 'car').note).toMatch(/car|taxi/i)
  })
})

describe('routeAvailability', () => {
  const near = { lat: 0, lng: 0 }
  const veryNear = { lat: 0.01, lng: 0.01 }
  const far = { lat: 0, lng: 5 } // ~555km at the equator

  it('rejects flight for short distances', () => {
    const result = routeAvailability(near, veryNear, 'flight')
    expect(result.available).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('accepts flight for long distances', () => {
    const result = routeAvailability(near, far, 'flight')
    expect(result.available).toBe(true)
  })

  it('always rejects train (not implemented)', () => {
    expect(routeAvailability(near, veryNear, 'train').available).toBe(false)
    expect(routeAvailability(near, far, 'train').available).toBe(false)
  })

  it('rejects bike beyond 80km', () => {
    // ~1 degree of longitude at the equator is ~111km
    const beyondBikeRange = { lat: 0, lng: 1 }
    expect(routeAvailability(near, beyondBikeRange, 'bike').available).toBe(false)
  })

  it('accepts bike within range', () => {
    const withinBikeRange = { lat: 0, lng: 0.3 }
    expect(routeAvailability(near, withinBikeRange, 'bike').available).toBe(true)
  })

  it('rejects walking beyond 35km', () => {
    const beyondWalkRange = { lat: 0, lng: 0.5 }
    expect(routeAvailability(near, beyondWalkRange, 'walk').available).toBe(false)
  })

  it('accepts walking within range', () => {
    expect(routeAvailability(near, veryNear, 'walk').available).toBe(true)
  })

  it('always accepts car regardless of distance', () => {
    expect(routeAvailability(near, veryNear, 'car').available).toBe(true)
    expect(routeAvailability(near, far, 'car').available).toBe(true)
  })
})
