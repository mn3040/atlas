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

export const ITEM_TYPE_ICONS: Record<ItemType, typeof MapPin> = {
  activity: MapPin,
  flight: Plane,
  stay: BedDouble,
}

export function iconForItem(type: ItemType, category: ActivityCategory | null) {
  if (type === 'activity' && category) return CATEGORY_ICONS[category]
  return ITEM_TYPE_ICONS[type]
}
