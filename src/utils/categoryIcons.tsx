import { Utensils, BedDouble, Landmark, TrainFront, ShoppingBag, Trees, MapPin } from 'lucide-react'
import type { StopCategory } from '../types/trip'

export const CATEGORY_ICONS: Record<StopCategory, typeof MapPin> = {
  food: Utensils,
  lodging: BedDouble,
  attraction: Landmark,
  transport: TrainFront,
  shopping: ShoppingBag,
  nature: Trees,
  other: MapPin,
}

export const CATEGORY_LABELS: Record<StopCategory, string> = {
  food: 'Food',
  lodging: 'Lodging',
  attraction: 'Attraction',
  transport: 'Transport',
  shopping: 'Shopping',
  nature: 'Nature',
  other: 'Other',
}
