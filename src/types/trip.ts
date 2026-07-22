export type ActivityCategory =
  | 'food'
  | 'attraction'
  | 'transport'
  | 'shopping'
  | 'nature'
  | 'other'

export type ItemType = 'activity' | 'flight' | 'stay'

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

export interface Item {
  id: string
  tripId: string
  dayId: string | null
  type: ItemType
  category: ActivityCategory | null
  name: string
  notes: string | null

  lat: number
  lng: number
  locationLabel: string | null

  lat2: number | null
  lng2: number | null
  location2Label: string | null

  startDate: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  flightNumber: string | null

  position: number
}
