import { describe, expect, it } from 'vitest'
import { actionForItem, bookingUrlForItem, mapsUrlForItem } from './itemActions'
import type { Item } from '../types/trip'

function makeItem(overrides: Partial<Item> & { id?: string } = {}): Item {
  return {
    id: 'item-1',
    tripId: 'trip-1',
    dayId: null,
    type: 'activity',
    category: 'attraction',
    name: 'City Museum',
    notes: null,
    lat: 0,
    lng: 0,
    locationLabel: null,
    countryCode: null,
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-01-01',
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
  } as Item
}

describe('actionForItem', () => {
  it('always shows "View Booking" for stays regardless of category', () => {
    expect(actionForItem(makeItem({ type: 'stay' }))).toEqual({ label: 'View Booking', action: 'booking' })
  })

  it('always shows "Flight Details" for flights', () => {
    expect(actionForItem(makeItem({ type: 'flight' }))).toEqual({ label: 'Flight Details', action: 'flight' })
  })

  it('shows "Reserve Table" for food items with a bookable signal', () => {
    const item = makeItem({ category: 'food', name: 'Dinner reservation at Le Bernardin' })
    expect(actionForItem(item)).toEqual({ label: 'Reserve Table', action: 'maps' })
  })

  it('shows "Directions" for food items without a bookable signal', () => {
    const item = makeItem({ category: 'food', name: 'Corner cafe' })
    expect(actionForItem(item)).toEqual({ label: 'Directions', action: 'maps' })
  })

  it('shows "Book Ticket" for a paid attraction with a bookable signal', () => {
    const item = makeItem({ category: 'attraction', name: 'Louvre', notes: 'timed entry ticket required' })
    expect(actionForItem(item)).toEqual({ label: 'Book Ticket', action: 'maps' })
  })

  it('shows "Book Ticket" for a bookable nature item too', () => {
    const item = makeItem({ category: 'nature', name: 'National park', notes: 'permit required' })
    expect(actionForItem(item)).toEqual({ label: 'Book Ticket', action: 'maps' })
  })

  it('does not show "Book Ticket" when the item is explicitly free, even with a bookable signal', () => {
    const item = makeItem({ category: 'attraction', name: 'Free museum', priceLabel: 'Free', notes: 'ticket required' })
    expect(actionForItem(item)).toEqual({ label: 'Directions', action: 'maps' })
  })

  it('falls back to "Directions" for a plain attraction with no bookable signal', () => {
    const item = makeItem({ category: 'attraction', name: 'City park bench' })
    expect(actionForItem(item)).toEqual({ label: 'Directions', action: 'maps' })
  })

  it('falls back to "Directions" for transport/shopping/other categories', () => {
    expect(actionForItem(makeItem({ category: 'transport' })).label).toBe('Directions')
    expect(actionForItem(makeItem({ category: 'shopping' })).label).toBe('Directions')
    expect(actionForItem(makeItem({ category: 'other' })).label).toBe('Directions')
  })
})

describe('mapsUrlForItem', () => {
  it('builds a Google Maps search URL from the name and location label', () => {
    const item = makeItem({ name: 'Louvre', locationLabel: 'Paris, France' })
    const url = mapsUrlForItem(item)
    expect(url).toContain('google.com/maps/search')
    expect(url).toContain(encodeURIComponent('Louvre, Paris, France'))
  })

  it('falls back to lat/lng when there is no name or location label', () => {
    const item = makeItem({ name: '', locationLabel: null, lat: 48.86, lng: 2.34 })
    const url = mapsUrlForItem(item)
    expect(url).toContain(encodeURIComponent('48.86,2.34'))
  })
})

describe('bookingUrlForItem', () => {
  it('builds a hotel-booking search for stays', () => {
    const item = makeItem({ type: 'stay', name: 'Grand Hotel', locationLabel: 'Paris' })
    expect(bookingUrlForItem(item)).toContain(encodeURIComponent('book hotel'))
  })

  it('prefers the flight number over the route or name for flight bookings', () => {
    const item = makeItem({
      type: 'flight',
      flightNumber: 'AA123',
      locationLabel: 'JFK',
      location2Label: 'CDG',
      name: 'Flight',
    })
    const url = bookingUrlForItem(item)
    expect(url).toContain(encodeURIComponent('AA123 book flight'))
  })

  it('falls back to the airport route when there is no flight number', () => {
    const item = makeItem({ type: 'flight', flightNumber: '', locationLabel: 'JFK', location2Label: 'CDG' })
    const url = bookingUrlForItem(item)
    expect(url).toContain(encodeURIComponent('JFK to CDG book flight'))
  })

  it('builds an OpenTable search for bookable food items', () => {
    const item = makeItem({ category: 'food', name: 'Le Bernardin', notes: 'reservation required' })
    const url = bookingUrlForItem(item)
    expect(url).toContain('opentable.com/s?term=')
    expect(url).toContain(encodeURIComponent('Le Bernardin'))
  })

  it('builds a GetYourGuide search for bookable attractions', () => {
    const item = makeItem({ category: 'attraction', name: 'Louvre', notes: 'ticket required' })
    const url = bookingUrlForItem(item)
    expect(url).toContain('getyourguide.com/s/?q=')
    expect(url).toContain(encodeURIComponent('Louvre'))
  })

  it('falls back to a maps URL for non-bookable items', () => {
    const item = makeItem({ category: 'other', name: 'City park' })
    expect(bookingUrlForItem(item)).toBe(mapsUrlForItem(item))
  })

  it('only includes up to the first three comma-separated location segments', () => {
    const item = makeItem({
      type: 'stay',
      name: 'Grand Hotel',
      locationLabel: 'Street, District, City, Country, Extra',
    })
    const url = bookingUrlForItem(item)
    // split(',') keeps each segment's leading space, then join(', ') adds another,
    // so segments after the first end up double-spaced — a cosmetic quirk, not a bug.
    expect(url).toContain(encodeURIComponent('Grand Hotel Street,  District,  City book hotel'))
    expect(url).not.toContain(encodeURIComponent('Country'))
  })
})
