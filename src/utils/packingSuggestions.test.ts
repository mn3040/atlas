import { describe, expect, it } from 'vitest'
import { suggestPackingItems } from './packingSuggestions'
import type { WeatherSummary } from '../api/weather'
import type { ActivityCategory, Item, ItemType } from '../types/trip'

function makeItem(overrides: Partial<Item> & { id: string; type: ItemType }): Item {
  return {
    tripId: 'trip-1',
    dayId: 'day-1',
    category: null,
    name: 'Stop',
    notes: null,
    lat: 0,
    lng: 0,
    locationLabel: null,
    countryCode: null,
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-03-01',
    endDate: null,
    startTime: null,
    endTime: null,
    flightNumber: null,
    priceLabel: null,
    photoUrl: null,
    googlePlaceId: null,
    googleMapsUrl: null,
    googleRating: null,
    googleUserRatingsTotal: null,
    roomType: null,
    guests: null,
    nightlyRate: null,
    taxesFees: null,
    confirmationNumber: null,
    rating: null,
    position: 0,
    ...overrides,
  }
}

function makeWeather(overrides: Partial<WeatherSummary>): WeatherSummary {
  return {
    date: '2026-03-01',
    label: 'Clear',
    tempHighC: 15,
    tempLowC: 8,
    tempHighF: 59,
    tempLowF: 46,
    precipitationMm: 0,
    windKmh: 10,
    isDateFallback: false,
    ...overrides,
  }
}

const shortTrip = { startDate: '2026-03-01', endDate: '2026-03-02' }
const longTrip = { startDate: '2026-03-01', endDate: '2026-03-08' }

describe('suggestPackingItems', () => {
  it('always includes the base travel essentials', () => {
    const result = suggestPackingItems({ trip: shortTrip, items: [], weather: null })

    expect(result.map((entry) => entry.label)).toEqual(
      expect.arrayContaining(['Passport / ID', 'Phone charger', 'Toothbrush & toothpaste', 'Underwear & socks']),
    )
  })

  it('adds laundry items only for trips of 3+ days, and detergent only for 6+', () => {
    const short = suggestPackingItems({ trip: shortTrip, items: [], weather: null })
    expect(short.some((entry) => entry.label === 'Laundry bag')).toBe(false)

    const medium = suggestPackingItems({ trip: { startDate: '2026-03-01', endDate: '2026-03-04' }, items: [], weather: null })
    expect(medium.some((entry) => entry.label === 'Laundry bag')).toBe(true)
    expect(medium.some((entry) => entry.label === 'Travel-size detergent')).toBe(false)

    const long = suggestPackingItems({ trip: longTrip, items: [], weather: null })
    expect(long.some((entry) => entry.label === 'Travel-size detergent')).toBe(true)
  })

  it('adds flight-specific items only when a flight is on the itinerary', () => {
    const withoutFlight = suggestPackingItems({ trip: shortTrip, items: [], weather: null })
    expect(withoutFlight.some((entry) => entry.label === 'Headphones / earplugs')).toBe(false)

    const withFlight = suggestPackingItems({ trip: shortTrip, items: [makeItem({ id: 'i1', type: 'flight' })], weather: null })
    expect(withFlight.some((entry) => entry.label === 'Headphones / earplugs')).toBe(true)
    expect(withFlight.some((entry) => entry.label === 'Copies of booking confirmations')).toBe(true)
  })

  it('adds sleepwear only when a stay is on the itinerary', () => {
    const withStay = suggestPackingItems({ trip: shortTrip, items: [makeItem({ id: 'i1', type: 'stay' })], weather: null })
    expect(withStay.some((entry) => entry.label === 'Sleepwear')).toBe(true)
  })

  it('adds category-driven gear based on activity categories present', () => {
    const withNature = suggestPackingItems({
      trip: shortTrip,
      items: [makeItem({ id: 'i1', type: 'activity', category: 'nature' as ActivityCategory })],
      weather: null,
    })

    expect(withNature.some((entry) => entry.label === 'Hiking shoes')).toBe(true)
    expect(withNature.some((entry) => entry.label === 'Insect repellent')).toBe(true)
  })

  it('adds cold-weather gear when the low temperature is at or below 50F', () => {
    const cold = suggestPackingItems({ trip: shortTrip, items: [], weather: makeWeather({ tempLowF: 32 }) })
    expect(cold.some((entry) => entry.label === 'Warm jacket')).toBe(true)
    expect(cold.some((entry) => entry.label === 'Gloves & beanie')).toBe(true)
  })

  it('adds hot-weather gear when the high temperature is at or above 80F', () => {
    const hot = suggestPackingItems({ trip: shortTrip, items: [], weather: makeWeather({ tempHighF: 90 }) })
    expect(hot.some((entry) => entry.label === 'Sunscreen')).toBe(true)
    expect(hot.some((entry) => entry.label === 'Sunglasses')).toBe(true)
  })

  it('adds rain gear when precipitation is expected', () => {
    const rainy = suggestPackingItems({ trip: shortTrip, items: [], weather: makeWeather({ precipitationMm: 4 }) })
    expect(rainy.some((entry) => entry.label === 'Rain jacket / umbrella')).toBe(true)

    const dry = suggestPackingItems({ trip: shortTrip, items: [], weather: makeWeather({ precipitationMm: 0 }) })
    expect(dry.some((entry) => entry.label === 'Rain jacket / umbrella')).toBe(false)
  })

  it('dedupes suggestions that multiple rules would add', () => {
    const result = suggestPackingItems({
      trip: longTrip,
      items: [makeItem({ id: 'i1', type: 'flight' }), makeItem({ id: 'i2', type: 'stay' })],
      weather: makeWeather({ tempLowF: 32, tempHighF: 90, precipitationMm: 4 }),
    })
    const labels = result.map((entry) => entry.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
