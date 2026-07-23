export interface PlaceResult {
  label: string
  lat: number
  lng: number
  /** Deep link to Google Maps for this coordinate — needs no API key, just opens maps.google.com. */
  mapsUrl: string
  /** ISO 3166-1 alpha-2, e.g. 'KZ'. */
  countryCode: string | null
}

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  address?: { country_code?: string }
}

interface TomTomResult {
  poi?: { name?: string }
  address?: { freeformAddress?: string; countryCode?: string; country?: string }
  position?: { lat?: number; lon?: number }
}

export interface PlaceSearchOptions {
  countryCodes?: string[]
  center?: { lat: number; lng: number }
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  options: PlaceSearchOptions = {},
): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return []
  if (TOMTOM_API_KEY) {
    try {
      const tomtomResults = await searchTomTomPlaces(query, signal, options)
      if (tomtomResults.length > 0) return tomtomResults
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error
      console.warn('tomtom place search failed, trying fallback', error)
    }
  }

  return searchNominatimPlaces(query, signal, options)
}

async function searchTomTomPlaces(
  query: string,
  signal?: AbortSignal,
  options: PlaceSearchOptions = {},
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ key: TOMTOM_API_KEY ?? '', limit: '8' })
  if (options.countryCodes?.length) params.set('countrySet', options.countryCodes.join(','))
  if (options.center) {
    params.set('lat', String(options.center.lat))
    params.set('lon', String(options.center.lng))
  }
  const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?${params.toString()}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`TomTom place search failed (${res.status})`)

  const data = (await res.json()) as { results?: TomTomResult[] }
  return (data.results ?? [])
    .map((result) => {
      const lat = result.position?.lat
      const lng = result.position?.lon
      if (typeof lat !== 'number' || typeof lng !== 'number') return null
      const label = [result.poi?.name, result.address?.freeformAddress || result.address?.country]
        .filter(Boolean)
        .join(', ')
      return {
        label: label || query,
        lat,
        lng,
        mapsUrl: googleMapsSearchUrl(label || query),
        countryCode: result.address?.countryCode?.toUpperCase() ?? null,
      }
    })
    .filter((result): result is PlaceResult => Boolean(result))
    .filter((result) => matchesCountry(result, options.countryCodes))
}

async function searchNominatimPlaces(
  query: string,
  signal?: AbortSignal,
  options: PlaceSearchOptions = {},
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    q: query,
  })
  if (options.countryCodes?.length) params.set('countrycodes', options.countryCodes.join(',').toLowerCase())
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)

  const results = (await res.json()) as NominatimResult[]
  return results
    .map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      mapsUrl: googleMapsSearchUrl(r.display_name),
      countryCode: r.address?.country_code ? r.address.country_code.toUpperCase() : null,
    }))
    .filter((result) => matchesCountry(result, options.countryCodes))
}

export function googleMapsSearchUrl(label: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
}

function matchesCountry(result: PlaceResult, countryCodes?: string[]): boolean {
  if (!countryCodes?.length || !result.countryCode) return true
  return countryCodes.includes(result.countryCode)
}
