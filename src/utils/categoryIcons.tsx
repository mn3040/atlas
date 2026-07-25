import { Utensils, Landmark, TrainFront, ShoppingBag, Trees, MapPin, Plane, BedDouble } from 'lucide-react'
import type { ActivityCategory, ItemType } from '../types/trip'

export const CATEGORY_ICONS: Record<ActivityCategory, typeof MapPin> = {
  food: Utensils,
  attraction: Landmark,
  transport: TrainFront,
  shopping: ShoppingBag,
  nature: Trees,
  other: MapPin,
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  food: 'Food',
  attraction: 'Attraction',
  transport: 'Transport',
  shopping: 'Shopping',
  nature: 'Nature',
  other: 'Other',
}

/** Dot/badge colors for activity categories, drawn from the same line
 * palette as budget categories and trip days (see utils/lineColors.ts). */
export const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  food: 'var(--color-paper)',
  attraction: 'var(--color-green)',
  transport: 'var(--color-line-3)',
  nature: 'var(--color-purple)',
  shopping: 'var(--color-line-5)',
  other: 'var(--color-text-dimmer)',
}

export const ITEM_TYPE_ICONS: Record<ItemType, typeof MapPin> = {
  activity: MapPin,
  flight: Plane,
  stay: BedDouble,
}

export function iconForItem(type: ItemType, category: ActivityCategory | null) {
  if (type === 'activity' && category) return CATEGORY_ICONS[category]
  return ITEM_TYPE_ICONS[type]
}

/** Emoji fallback for the photo slot when an item has no photoUrl. */
export const CATEGORY_EMOJI: Record<ActivityCategory, string> = {
  food: '🍽️',
  attraction: '🏛️',
  transport: '🚆',
  shopping: '🛍️',
  nature: '🌲',
  other: '📍',
}

export const ITEM_TYPE_EMOJI: Record<ItemType, string> = {
  activity: '📍',
  flight: '✈️',
  stay: '🏨',
}

export function emojiForItem(type: ItemType, category: ActivityCategory | null): string {
  if (type === 'activity' && category) return CATEGORY_EMOJI[category]
  return ITEM_TYPE_EMOJI[type]
}
