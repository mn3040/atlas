import { supabase } from './supabaseClient'
import type { Trip, Day, Item, ItemType, ActivityCategory } from '../types/trip'

interface TripRow {
  id: string
  owner_id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
}

interface DayRow {
  id: string
  trip_id: string
  date: string
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
  position: number
}

function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  }
}

function mapDay(row: DayRow): Day {
  return { id: row.id, tripId: row.trip_id, date: row.date }
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
  startDate: string
  endDate: string
  ownerId: string
}): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      owner_id: input.ownerId,
    })
    .select()
    .single()

  if (error) throw error
  return mapTrip(data as TripRow)
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
      position: input.position,
    })
    .select()
    .single()

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
