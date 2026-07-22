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
  if (item.category === 'food') return { label: 'Reserve Table', action: 'maps' }
  const isFree = (item.priceLabel ?? '').toLowerCase().includes('free')
  if (!isFree && (item.category === 'attraction' || item.category === 'nature')) {
    return { label: 'Book Ticket', action: 'maps' }
  }
  return { label: 'View Details', action: 'maps' }
}
