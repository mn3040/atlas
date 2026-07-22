import { supabase } from './supabaseClient'
import type { Trip, Day, Item, ItemType, ActivityCategory } from '../types/trip'

interface TripRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  country_code: string | null
  start_date: string
  end_date: string
  created_at: string
}

interface DayRow {
  id: string
  trip_id: string
  date: string
  label: string | null
}

interface ItemRow {
  id: string
  trip_id: string
  day_id: string | null
  type: ItemType
  category: ActivityCategory | null
  name: string
  notes: string | null
  lat: number
  lng: number
  location_label: string | null
  lat2: number | null
  lng2: number | null
  location2_label: string | null
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  flight_number: string | null
  price_label: string | null
  photo_url: string | null
  google_place_id: string | null
  google_maps_url: string | null
  google_rating: number | null
  google_user_ratings_total: number | null
  room_type: string | null
  guests: number | null
  nightly_rate: number | null
  taxes_fees: number | null
  confirmation_number: string | null
  rating: number | null
  position: number
}

function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    countryCode: row.country_code,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  }
}

function mapDay(row: DayRow): Day {
  return { id: row.id, tripId: row.trip_id, date: row.date, label: row.label }
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayId: row.day_id,
    type: row.type,
    category: row.category,
    name: row.name,
    notes: row.notes,
    lat: row.lat,
    lng: row.lng,
    locationLabel: row.location_label,
    lat2: row.lat2,
    lng2: row.lng2,
    location2Label: row.location2_label,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    flightNumber: row.flight_number,
    priceLabel: row.price_label,
    photoUrl: row.photo_url,
    googlePlaceId: row.google_place_id,
    googleMapsUrl: row.google_maps_url,
    googleRating: row.google_rating,
    googleUserRatingsTotal: row.google_user_ratings_total,
    roomType: row.room_type,
    guests: row.guests,
    nightlyRate: row.nightly_rate,
    taxesFees: row.taxes_fees,
    confirmationNumber: row.confirmation_number,
    rating: row.rating,
    position: row.position,
  }
}

export async function fetchTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: true })

  if (error) throw error
  return (data as TripRow[]).map(mapTrip)
}

export async function fetchTrip(tripId: string): Promise<Trip> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (error) throw error
  return mapTrip(data as TripRow)
}

export async function createTrip(input: {
  name: string
  description?: string
  countryCode?: string
  startDate: string
  endDate: string
  ownerId: string
}): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      name: input.name,
      description: input.description || null,
      country_code: input.countryCode || null,
      start_date: input.startDate,
      end_date: input.endDate,
      owner_id: input.ownerId,
    })
    .select()
    .single()

  if (error) throw error
  return mapTrip(data as TripRow)
}

export async function updateTrip(
  tripId: string,
  input: {
    name?: string
    description?: string | null
    countryCode?: string | null
    startDate?: string
    endDate?: string
  },
): Promise<Trip> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description || null
  if (input.countryCode !== undefined) patch.country_code = input.countryCode || null
  if (input.startDate !== undefined) patch.start_date = input.startDate
  if (input.endDate !== undefined) patch.end_date = input.endDate

  const { data, error } = await supabase.from('trips').update(patch).eq('id', tripId).select().single()
  if (error) throw error
  return mapTrip(data as TripRow)
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId)
  if (error) throw error
}

export async function fetchDays(tripId: string): Promise<Day[]> {
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: true })

  if (error) throw error
  return (data as DayRow[]).map(mapDay)
}

export async function createDay(tripId: string, date: string): Promise<Day> {
  const { data, error } = await supabase
    .from('days')
    .insert({ trip_id: tripId, date })
    .select()
    .single()

  if (error) throw error
  return mapDay(data as DayRow)
}

export async function updateDayLabel(dayId: string, label: string | null): Promise<void> {
  const { error } = await supabase.from('days').update({ label }).eq('id', dayId)
  if (error) throw error
}

export async function fetchItems(tripId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('trip_id', tripId)
    .order('position', { ascending: true })

  if (error) throw error
  return (data as ItemRow[]).map(mapItem)
}

export interface NewItemInput {
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
  priceLabel?: string | null
  photoUrl?: string | null
  googlePlaceId?: string | null
  googleMapsUrl?: string | null
  googleRating?: number | null
  googleUserRatingsTotal?: number | null
  roomType?: string | null
  guests?: number | null
  nightlyRate?: number | null
  taxesFees?: number | null
  confirmationNumber?: string | null
  rating?: number | null
  position: number
}

export async function createItem(input: NewItemInput): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      trip_id: input.tripId,
      day_id: input.dayId,
      type: input.type,
      category: input.category,
      name: input.name,
      notes: input.notes,
      lat: input.lat,
      lng: input.lng,
      location_label: input.locationLabel,
      lat2: input.lat2,
      lng2: input.lng2,
      location2_label: input.location2Label,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      flight_number: input.flightNumber,
      price_label: input.priceLabel ?? null,
      photo_url: input.photoUrl ?? null,
      google_place_id: input.googlePlaceId ?? null,
      google_maps_url: input.googleMapsUrl ?? null,
      google_rating: input.googleRating ?? null,
      google_user_ratings_total: input.googleUserRatingsTotal ?? null,
      room_type: input.roomType ?? null,
      guests: input.guests ?? null,
      nightly_rate: input.nightlyRate ?? null,
      taxes_fees: input.taxesFees ?? null,
      confirmation_number: input.confirmationNumber ?? null,
      rating: input.rating ?? null,
      position: input.position,
    })
    .select()
    .single()

  if (error) throw error
  return mapItem(data as ItemRow)
}

export interface ItemUpdateInput {
  dayId?: string | null
  category?: ActivityCategory | null
  name?: string
  notes?: string | null
  lat?: number
  lng?: number
  locationLabel?: string | null
  lat2?: number | null
  lng2?: number | null
  location2Label?: string | null
  priceLabel?: string | null
  photoUrl?: string | null
  googlePlaceId?: string | null
  googleMapsUrl?: string | null
  googleRating?: number | null
  googleUserRatingsTotal?: number | null
  startDate?: string
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  flightNumber?: string | null
  roomType?: string | null
  guests?: number | null
  nightlyRate?: number | null
  taxesFees?: number | null
  confirmationNumber?: string | null
  rating?: number | null
}

export async function updateItem(itemId: string, input: ItemUpdateInput): Promise<Item> {
  const patch: Record<string, unknown> = {}
  if (input.dayId !== undefined) patch.day_id = input.dayId
  if (input.category !== undefined) patch.category = input.category
  if (input.name !== undefined) patch.name = input.name
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.lat !== undefined) patch.lat = input.lat
  if (input.lng !== undefined) patch.lng = input.lng
  if (input.locationLabel !== undefined) patch.location_label = input.locationLabel
  if (input.lat2 !== undefined) patch.lat2 = input.lat2
  if (input.lng2 !== undefined) patch.lng2 = input.lng2
  if (input.location2Label !== undefined) patch.location2_label = input.location2Label
  if (input.priceLabel !== undefined) patch.price_label = input.priceLabel
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl
  if (input.googlePlaceId !== undefined) patch.google_place_id = input.googlePlaceId
  if (input.googleMapsUrl !== undefined) patch.google_maps_url = input.googleMapsUrl
  if (input.googleRating !== undefined) patch.google_rating = input.googleRating
  if (input.googleUserRatingsTotal !== undefined) patch.google_user_ratings_total = input.googleUserRatingsTotal
  if (input.startDate !== undefined) patch.start_date = input.startDate
  if (input.endDate !== undefined) patch.end_date = input.endDate
  if (input.startTime !== undefined) patch.start_time = input.startTime
  if (input.endTime !== undefined) patch.end_time = input.endTime
  if (input.flightNumber !== undefined) patch.flight_number = input.flightNumber
  if (input.roomType !== undefined) patch.room_type = input.roomType
  if (input.guests !== undefined) patch.guests = input.guests
  if (input.nightlyRate !== undefined) patch.nightly_rate = input.nightlyRate
  if (input.taxesFees !== undefined) patch.taxes_fees = input.taxesFees
  if (input.confirmationNumber !== undefined) patch.confirmation_number = input.confirmationNumber
  if (input.rating !== undefined) patch.rating = input.rating

  const { data, error } = await supabase.from('items').update(patch).eq('id', itemId).select().single()
  if (error) throw error
  return mapItem(data as ItemRow)
}

export async function updateItemPosition(itemId: string, position: number): Promise<void> {
  const { error } = await supabase.from('items').update({ position }).eq('id', itemId)
  if (error) throw error
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}
