import { loadPlacesLibrary } from './googleMapsLoader'

export interface GooglePlaceResult {
  label: string
  lat: number
  lng: number
  placeId: string
  mapsUrl: string | null
  photoUrl: string | null
  rating: number | null
  userRatingsTotal: number | null
  priceLabel: string | null
  countryCode: string | null
}

export interface PlaceSuggestion {
  placeId: string
  label: string
  fetchDetails: () => Promise<GooglePlaceResult>
}

const PRICE_LEVEL_LABEL: Partial<Record<string, string>> = {
  FREE: 'Free entry',
  INEXPENSIVE: '$ · Inexpensive',
  MODERATE: '$$ · Moderate',
  EXPENSIVE: '$$$ · Expensive',
  VERY_EXPENSIVE: '$$$$ · Very expensive',
}

const DETAIL_FIELDS = [
  'displayName',
  'formattedAddress',
  'location',
  'googleMapsURI',
  'rating',
  'userRatingCount',
  'photos',
  'priceLevel',
  'addressComponents',
]

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  if (query.trim().length < 2) return []
  const places = await loadPlacesLibrary()
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query })
  if (signal?.aborted) return []

  return suggestions
    .filter((s): s is typeof s & { placePrediction: NonNullable<typeof s.placePrediction> } => Boolean(s.placePrediction))
    .map((s) => {
      const prediction = s.placePrediction
      return {
        placeId: prediction.placeId,
        label: prediction.text.text,
        fetchDetails: () => detailsFromPlace(prediction.toPlace()),
      }
    })
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlaceResult> {
  const places = await loadPlacesLibrary()
  return detailsFromPlace(new places.Place({ id: placeId }))
}

async function detailsFromPlace(place: google.maps.places.Place): Promise<GooglePlaceResult> {
  await place.fetchFields({ fields: DETAIL_FIELDS })
  const photo = place.photos?.[0]
  const countryComponent = place.addressComponents?.find((c) => c.types.includes('country'))

  return {
    label: place.displayName || place.formattedAddress || '',
    lat: place.location?.lat() ?? 0,
    lng: place.location?.lng() ?? 0,
    placeId: place.id,
    mapsUrl: place.googleMapsURI ?? null,
    photoUrl: photo ? photo.getURI({ maxWidth: 480 }) : null,
    rating: place.rating ?? null,
    userRatingsTotal: place.userRatingCount ?? null,
    priceLabel: place.priceLevel ? (PRICE_LEVEL_LABEL[place.priceLevel] ?? null) : null,
    countryCode: countryComponent?.shortText ?? null,
  }
}
