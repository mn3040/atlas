import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRoute, isRoutable } from './tomtomRouting'

// Like geocoding.test.ts, vitest.config.ts sets a fixed VITE_TOMTOM_API_KEY
// for the test run, so fetchRoute exercises the real "has a key" branch for
// routable modes regardless of any local .env. fetch is always mocked below.

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('isRoutable', () => {
  it('treats walk/bike/car as routable', () => {
    expect(isRoutable('walk')).toBe(true)
    expect(isRoutable('bike')).toBe(true)
    expect(isRoutable('car')).toBe(true)
  })

  it('treats train/flight as not routable (no TomTom equivalent)', () => {
    expect(isRoutable('train')).toBe(false)
    expect(isRoutable('flight')).toBe(false)
  })
})

describe('fetchRoute', () => {
  it('returns null for a non-routable mode without calling fetch', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const route = await fetchRoute([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }], 'flight')
    expect(route).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when fewer than two points are given', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const route = await fetchRoute([{ lat: 0, lng: 0 }], 'car')
    expect(route).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('flattens route legs into a [lng, lat] coordinate list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            legs: [
              {
                points: [
                  { latitude: 1, longitude: 2 },
                  { latitude: 3, longitude: 4 },
                ],
              },
              { points: [{ latitude: 5, longitude: 6 }] },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch

    const route = await fetchRoute([{ lat: 1, lng: 2 }, { lat: 5, lng: 6 }], 'car')
    expect(route).toEqual([
      [2, 1],
      [4, 3],
      [6, 5],
    ])
  })

  it('returns null when the response has fewer than 2 combined points', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ legs: [{ points: [{ latitude: 1, longitude: 2 }] }] }] }),
    }) as unknown as typeof fetch

    const route = await fetchRoute([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], 'car')
    expect(route).toBeNull()
  })

  it('returns null when the HTTP response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as unknown as typeof fetch

    const route = await fetchRoute([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], 'car')
    expect(route).toBeNull()
  })

  it('returns null (and logs) instead of throwing when fetch rejects for a non-abort reason', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const route = await fetchRoute([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], 'car')
    expect(route).toBeNull()
  })

  it('swallows an AbortError the same way, without logging it as an error', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const route = await fetchRoute([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], 'car')
    expect(route).toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('returns null when the response has no routes/legs at all', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch

    const route = await fetchRoute([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], 'car')
    expect(route).toBeNull()
  })
})
