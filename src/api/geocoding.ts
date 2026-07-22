export interface PlaceResult {
  label: string
  lat: number
  lng: number
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '6')

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Place search failed')

  const results = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
  return results.map((result) => ({
    label: result.display_name,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  }))
}
