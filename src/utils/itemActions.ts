import type { Item } from '../types/trip'

export type ItemAction = 'booking' | 'flight' | 'maps'

export interface ItemActionMeta {
  label: string
  action: ItemAction
}

/** What the timeline card's action pill says, and where it goes — derived
 * from the item's type/category/price rather than stored, so it stays
 * correct as data changes. Stays open Booking Detail, flights open Flight
 * Detail (both in-app screens); everything else links out to Google Maps
 * when a place was matched (falls back to the edit form otherwise — see
 * TripDetail's handleAction). */
export function actionForItem(item: Item): ItemActionMeta {
  if (item.type === 'stay') return { label: 'View Booking', action: 'booking' }
  if (item.type === 'flight') return { label: 'Flight Details', action: 'flight' }
  if (item.category === 'food') {
    return hasBookableSignal(item) ? { label: 'Reserve Table', action: 'maps' } : { label: 'Directions', action: 'maps' }
  }
  const isFree = (item.priceLabel ?? '').toLowerCase().includes('free')
  if (!isFree && (item.category === 'attraction' || item.category === 'nature') && hasBookableSignal(item)) {
    return { label: 'Book Ticket', action: 'maps' }
  }
  return { label: 'Directions', action: 'maps' }
}

function hasBookableSignal(item: Item): boolean {
  return /\b(?:book|ticket|reservation|reserve|timed|permit|tour|pass|entry|required)\b/i.test(
    `${item.name} ${item.priceLabel ?? ''} ${item.notes ?? ''}`,
  )
}

function searchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export function mapsUrlForItem(item: Item): string {
  const label = [item.name, item.locationLabel].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label || `${item.lat},${item.lng}`)}`
}

export function bookingUrlForItem(item: Item): string {
  const location = item.locationLabel?.split(',').slice(0, 3).join(', ') ?? ''
  const nameAndPlace = [item.name, location].filter(Boolean).join(' ')

  if (item.type === 'stay') return searchUrl(`${nameAndPlace} book hotel`)
  if (item.type === 'flight') {
    const route = [item.locationLabel, item.location2Label].filter(Boolean).join(' to ')
    return searchUrl(`${item.flightNumber || route || item.name} book flight`)
  }
  if (item.category === 'food' && hasBookableSignal(item)) return searchUrl(`${nameAndPlace} reservation`)
  if ((item.category === 'attraction' || item.category === 'nature') && hasBookableSignal(item)) {
    return searchUrl(`${nameAndPlace} official tickets`)
  }
  return mapsUrlForItem(item)
}
