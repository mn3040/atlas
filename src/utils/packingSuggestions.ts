import type { WeatherSummary } from '../api/weather'
import type { ActivityCategory, Item, PackingCategory, Trip } from '../types/trip'

export interface SuggestedPackingItem {
  label: string
  category: PackingCategory
}

const BASE_ITEMS: SuggestedPackingItem[] = [
  { label: 'Passport / ID', category: 'documents' },
  { label: 'Phone charger', category: 'electronics' },
  { label: 'Toothbrush & toothpaste', category: 'toiletries' },
  { label: 'Underwear & socks', category: 'clothing' },
]

const CATEGORY_ITEMS: Partial<Record<ActivityCategory, SuggestedPackingItem[]>> = {
  nature: [
    { label: 'Hiking shoes', category: 'gear' },
    { label: 'Insect repellent', category: 'toiletries' },
  ],
  transport: [{ label: 'Travel pillow', category: 'gear' }],
  shopping: [{ label: 'Packable tote bag', category: 'gear' }],
  attraction: [{ label: 'Portable phone battery', category: 'electronics' }],
}

function tripLengthDays(trip: Pick<Trip, 'startDate' | 'endDate'>): number {
  const start = new Date(`${trip.startDate}T00:00:00`).getTime()
  const end = new Date(`${trip.endDate}T00:00:00`).getTime()
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

/**
 * Pure suggestion engine for the packing list "Suggest items" action. Takes
 * the same trip length, itinerary categories, and forecast the WeatherChip
 * already surfaces, and turns them into a deduped list of packing items.
 */
export function suggestPackingItems({
  trip,
  items,
  weather,
}: {
  trip: Pick<Trip, 'startDate' | 'endDate'>
  items: Item[]
  weather: WeatherSummary | null
}): SuggestedPackingItem[] {
  const suggestions = new Map<string, SuggestedPackingItem>()
  const add = (entry: SuggestedPackingItem) => suggestions.set(entry.label, entry)

  BASE_ITEMS.forEach(add)

  const days = tripLengthDays(trip)
  if (days >= 3) {
    add({ label: 'Laundry bag', category: 'gear' })
    add({ label: 'Extra change of clothes', category: 'clothing' })
  }
  if (days >= 6) {
    add({ label: 'Travel-size detergent', category: 'toiletries' })
  }

  if (items.some((item) => item.type === 'flight')) {
    add({ label: 'Headphones / earplugs', category: 'electronics' })
    add({ label: 'Copies of booking confirmations', category: 'documents' })
  }
  if (items.some((item) => item.type === 'stay')) {
    add({ label: 'Sleepwear', category: 'clothing' })
  }

  const categories = new Set(items.map((item) => item.category).filter((category): category is ActivityCategory => category != null))
  for (const category of categories) {
    for (const entry of CATEGORY_ITEMS[category] ?? []) add(entry)
  }

  if (weather) {
    if (weather.tempLowF <= 50) {
      add({ label: 'Warm jacket', category: 'clothing' })
      add({ label: 'Gloves & beanie', category: 'clothing' })
    }
    if (weather.tempHighF >= 80) {
      add({ label: 'Sunscreen', category: 'toiletries' })
      add({ label: 'Sunglasses', category: 'clothing' })
      add({ label: 'Light, breathable clothing', category: 'clothing' })
    }
    if (weather.precipitationMm >= 1) {
      add({ label: 'Rain jacket / umbrella', category: 'gear' })
    }
  }

  return Array.from(suggestions.values())
}
