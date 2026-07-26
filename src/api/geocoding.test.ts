import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleMapsSearchUrl, searchPlaces } from './geocoding'

// vitest.config.ts sets a fixed VITE_TOMTOM_API_KEY for the test run, so
// searchPlaces exercises the real "TomTom first, Nominatim fallback" branch
// here regardless of any local .env. fetch is always mocked below — no real
// network calls or key values are used or asserted on.

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('searchPlaces', () => {
  it('returns an empty array without calling fetch for a too-short query', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const results = await searchPlaces('a')
    expect(results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns TomTom results when TomTom finds something', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            poi: { name: 'Grand Bazaar' },
            address: { freeformAddress: 'Istanbul, Turkey', countryCode: 'tr' },
            position: { lat: 41.01, lon: 28.97 },
          },
        ],
      }),
    }) as unknown as typeof fetch

    const results = await searchPlaces('Grand Bazaar')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ label: 'Grand Bazaar, Istanbul, Turkey', lat: 41.01, lng: 28.97, countryCode: 'TR' })
  })

  it('drops TomTom results missing usable coordinates', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ poi: { name: 'No coords' }, position: {} }] }),
    }) as unknown as typeof fetch

    // TomTom returns zero usable results, so it should fall through to Nominatim.
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ display_name: 'Fallback Place', lat: '1.0', lon: '2.0' }],
    })

    const results = await searchPlaces('No coords')
    expect(results).toEqual([
      {
        label: 'Fallback Place',
        lat: 1.0,
        lng: 2.0,
        mapsUrl: googleMapsSearchUrl('Fallback Place'),
        countryCode: null,
      },
    ])
  })

  it('falls back to Nominatim when TomTom returns zero results', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ display_name: 'Osh Bazaar, Osh, Kyrgyzstan', lat: '40.5', lon: '72.8', address: { country_code: 'kg' } }],
      }) as unknown as typeof fetch

    const results = await searchPlaces('Osh Bazaar')
    expect(results).toEqual([
      {
        label: 'Osh Bazaar, Osh, Kyrgyzstan',
        lat: 40.5,
        lng: 72.8,
        mapsUrl: googleMapsSearchUrl('Osh Bazaar, Osh, Kyrgyzstan'),
        countryCode: 'KG',
      },
    ])
  })

  it('falls back to Nominatim when the TomTom request throws a non-abort error', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ display_name: 'Fallback Place', lat: '1', lon: '2' }],
      }) as unknown as typeof fetch
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const results = await searchPlaces('Fallback Place')
    expect(results[0].label).toBe('Fallback Place')
  })

  it('rethrows an AbortError from TomTom instead of falling back', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch

    await expect(searchPlaces('Anything')).rejects.toThrow('Aborted')
  })

  it('filters Nominatim results by the requested country codes', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { display_name: 'Place in France', lat: '1', lon: '2', address: { country_code: 'fr' } },
          { display_name: 'Place in Kyrgyzstan', lat: '3', lon: '4', address: { country_code: 'kg' } },
        ],
      }) as unknown as typeof fetch

    const results = await searchPlaces('Place', undefined, { countryCodes: ['KG'] })
    expect(results).toHaveLength(1)
    expect(results[0].label).toBe('Place in Kyrgyzstan')
  })

  it('throws a descriptive error when the Nominatim response is not ok', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) }) as unknown as typeof fetch

    await expect(searchPlaces('Anything')).rejects.toThrow('Place search failed (503)')
  })
})

describe('googleMapsSearchUrl', () => {
  it('builds a maps search URL with the label URL-encoded', () => {
    expect(googleMapsSearchUrl('Grand Bazaar, Istanbul')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Grand Bazaar, Istanbul')}`,
    )
  })
})
