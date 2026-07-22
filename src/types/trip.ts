export type StopCategory =
  | 'food'
  | 'lodging'
  | 'attraction'
  | 'transport'
  | 'shopping'
  | 'nature'
  | 'other'

export interface Trip {
  id: string
  ownerId: string
  name: string
  startDate: string
  endDate: string
  createdAt: string
}

export interface TripMember {
  tripId: string
  userId: string
  role: 'owner' | 'editor' | 'viewer'
}

export interface Day {
  id: string
  tripId: string
  date: string
}

export interface Stop {
  id: string
  dayId: string
  name: string
  category: StopCategory
  lat: number
  lng: number
  startTime: string | null
  notes: string | null
  order: number
}
