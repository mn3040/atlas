export interface LatLng {
  lat: number
  lng: number
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export type TravelMode = 'walk' | 'bike' | 'car' | 'train' | 'flight'

export const TRAVEL_MODES: { id: TravelMode; label: string; speedKmh: number }[] = [
  { id: 'walk', label: 'Walking', speedKmh: 4.5 },
  { id: 'bike', label: 'Cycling', speedKmh: 15 },
  { id: 'car', label: 'Car', speedKmh: 42 },
  { id: 'train', label: 'Train', speedKmh: 70 },
  { id: 'flight', label: 'Flight', speedKmh: 550 },
]

const TRAVEL_NOTES: Record<TravelMode, string> = {
  walk: 'A comfortable walk between stops — worth checking the weather first.',
  bike: 'Doable by bike if there are lanes or low-traffic streets nearby.',
  car: 'Fastest by car or taxi if the distance is more than a short walk.',
  train: 'Worth checking if local rail connects these two points directly.',
  flight: 'Long enough that a domestic flight may be the only practical option.',
}

export const TRAVEL_CTAS: Record<TravelMode, string> = {
  walk: 'Get Directions',
  bike: 'Find a Bike Route',
  car: 'Get Directions',
  train: 'Find Train Times',
  flight: 'Find Flights',
}

export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
  }
  return `${minutes} min`
}

export function estimateTravel(from: LatLng, to: LatLng, mode: TravelMode) {
  const km = haversineKm(from, to)
  const speed = TRAVEL_MODES.find((m) => m.id === mode)!.speedKmh
  const minutes = Math.max(3, Math.round((km / speed) * 60))
  return { km, minutes, duration: formatDuration(minutes), note: TRAVEL_NOTES[mode] }
}

export function routeAvailability(from: LatLng, to: LatLng, mode: TravelMode): { available: boolean; reason?: string } {
  const km = haversineKm(from, to)
  if (mode === 'flight' && km < 220) {
    return { available: false, reason: 'Flight is not a practical route for this distance.' }
  }
  if (mode === 'train') {
    return { available: false, reason: 'Train routing is not available for this route yet.' }
  }
  if (mode === 'bike' && km > 80) {
    return { available: false, reason: 'Bike routing is not practical for this distance.' }
  }
  if (mode === 'walk' && km > 35) {
    return { available: false, reason: 'Walking is not practical for this distance.' }
  }
  return { available: true }
}
