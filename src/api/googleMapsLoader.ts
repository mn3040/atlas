import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
let optionsSet = false
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null

export function hasGoogleMapsKey(): boolean {
  return Boolean(apiKey)
}

/** Loads the Places library once and caches the promise; every caller shares it. */
export function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))
  if (!optionsSet) {
    setOptions({ key: apiKey, v: 'weekly' })
    optionsSet = true
  }
  if (!placesPromise) placesPromise = importLibrary('places')
  return placesPromise
}
