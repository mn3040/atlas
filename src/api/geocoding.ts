export interface PlaceResult {
  label: string
  lat: number
  lng: number
  /** Deep link to Google Maps for this coordinate — needs no API key, just opens maps.google.com. */
  mapsUrl: string
  /** ISO 3166-1 alpha-2, e.g. 'KZ'. */
  countryCode: string | null
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  address?: { country_code?: string }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return []

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Place search failed')

  const results = (await res.json()) as NominatimResult[]
  return results.map((r) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    mapsUrl: googleMapsSearchUrl(r.display_name),
    countryCode: r.address?.country_code ? r.address.country_code.toUpperCase() : null,
  }))
}

export function googleMapsSearchUrl(label: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
}
