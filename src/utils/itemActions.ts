import type { Item } from '../types/trip'

export type ItemAction = 'booking' | 'maps'

export interface ItemActionMeta {
  label: string
  action: ItemAction
}

/** What the timeline card's action pill says, and whether it opens the
 * Booking Detail screen or the item's Google Maps page — derived from the
 * item's type/category/price rather than stored, so it stays correct as
 * data changes. Stays always go to Booking Detail; everything else links
 * out to Google Maps when a place was matched (falls back to the edit
 * form otherwise — see TripDetail's handleAction). */
export function actionForItem(item: Item): ItemActionMeta {
  if (item.type === 'stay') return { label: 'View Booking', action: 'booking' }
  if (item.type === 'flight') return { label: 'Flight Details', action: 'maps' }
  if (item.category === 'food') return { label: 'Reserve Table', action: 'maps' }
  const isFree = (item.priceLabel ?? '').toLowerCase().includes('free')
  if (!isFree && (item.category === 'attraction' || item.category === 'nature')) {
    return { label: 'Book Ticket', action: 'maps' }
  }
  return { label: 'View Details', action: 'maps' }
}
