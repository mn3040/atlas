export type ActivityCategory =
  | 'food'
  | 'attraction'
  | 'transport'
  | 'shopping'
  | 'nature'
  | 'other'

export type ItemType = 'activity' | 'flight' | 'stay'
export type TripVisibility = 'personal' | 'group'

export interface Trip {
  id: string
  ownerId: string
  name: string
  description: string | null
  /** ISO 3166-1 alpha-2, e.g. 'KZ' — drives the flag shown next to the dates. */
  countryCode: string | null
  visibility: TripVisibility
  memberLimit: number | null
  archivedAt: string | null
  startDate: string
  endDate: string
  createdAt: string
}

export interface TripMember {
  tripId: string
  userId: string
  role: 'owner' | 'editor' | 'viewer'
}

export interface TripMemberWithProfile extends TripMember {
  displayName: string
  avatarColor: string
}

export interface TripInvite {
  id: string
  tripId: string
  token: string
  createdBy: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface VoteProfile {
  userId: string
  displayName: string
  avatarColor: string
}

export interface ItemVoteSummary {
  itemId: string
  voters: VoteProfile[]
  viewerVoted: boolean
}

export interface ItemDecision {
  tripId: string
  dayId: string
  itemId: string
  decidedBy: string
  decidedAt: string
}

export interface Profile {
  userId: string
  displayName: string
  avatarColor: string
  createdAt: string
  updatedAt: string
}

export type ExpenseCategory = 'transport' | 'lodging' | 'food' | 'activities' | 'shopping' | 'other'

export interface ExpenseShare {
  expenseId: string
  userId: string
  shareAmount: number
}

export interface Expense {
  id: string
  tripId: string
  description: string
  amount: number
  category: ExpenseCategory
  paidBy: string
  spentOn: string
  notes: string | null
  createdBy: string
  createdAt: string
  shares: ExpenseShare[]
}

export type DocumentType = 'passport' | 'visa' | 'boarding_pass' | 'confirmation' | 'insurance' | 'other'

export interface TripDocument {
  id: string
  tripId: string
  uploadedBy: string
  type: DocumentType
  title: string
  documentNumber: string | null
  issuingCountry: string | null
  expiryDate: string | null
  notes: string | null
  filePath: string | null
  fileName: string | null
  mimeType: string | null
  createdAt: string
}

export type PackingCategory = 'clothing' | 'documents' | 'toiletries' | 'electronics' | 'gear' | 'other'

export interface PackingItem {
  id: string
  tripId: string
  label: string
  category: PackingCategory
  packed: boolean
  createdBy: string
  createdAt: string
}

export interface Day {
  id: string
  tripId: string
  date: string
  label: string | null
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
  countryCode: string | null

  lat2: number | null
  lng2: number | null
  location2Label: string | null

  startDate: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  flightNumber: string | null

  priceLabel: string | null
  photoUrl: string | null

  // Set when the location was picked from Google Places search.
  googlePlaceId: string | null
  googleMapsUrl: string | null
  googleRating: number | null
  googleUserRatingsTotal: number | null

  // Booking detail — only set when type is 'stay'.
  roomType: string | null
  guests: number | null
  nightlyRate: number | null
  taxesFees: number | null
  confirmationNumber: string | null
  rating: number | null

  position: number
}
