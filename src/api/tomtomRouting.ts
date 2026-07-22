import type { TravelMode } from '../utils/distance'

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined

/** TomTom's Routing API only knows road/path travel — train and flight have no equivalent. */
const ROUTABLE_MODES: Partial<Record<TravelMode, string>> = {
  walk: 'pedestrian',
  bike: 'bicycle',
  car: 'car',
}

export function isRoutable(mode: TravelMode): boolean {
  return mode in ROUTABLE_MODES
}

/**
 * Fetches a real road/path-following route through an ordered list of stops.
 * Returns null (caller should fall back to a straight line) if the mode isn't
 * routable, there's no key, or the request fails for any reason.
 */
export async function fetchRoute(
  points: { lat: number; lng: number }[],
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<[number, number][] | null> {
  const travelMode = ROUTABLE_MODES[mode]
  if (!travelMode || !TOMTOM_API_KEY || points.length < 2) return null

  const locations = points.map((p) => `${p.lat},${p.lng}`).join(':')
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${TOMTOM_API_KEY}&travelMode=${travelMode}`

  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    const legs = data.routes?.[0]?.legs as { points: { latitude: number; longitude: number }[] }[] | undefined
    if (!legs) return null
    const coords: [number, number][] = []
    for (const leg of legs) {
      for (const p of leg.points) coords.push([p.longitude, p.latitude])
    }
    return coords.length > 1 ? coords : null
  } catch (error) {
    if ((error as Error).name !== 'AbortError') console.error('tomtom routing error', error)
    return null
  }
}
