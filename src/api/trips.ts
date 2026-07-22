import { supabase } from './supabaseClient'
import type { Trip, Day, Stop, StopCategory } from '../types/trip'

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

interface StopRow {
  id: string
  day_id: string
  name: string
  category: StopCategory
  lat: number
  lng: number
  start_time: string | null
  notes: string | null
  order: number
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

function mapStop(row: StopRow): Stop {
  return {
    id: row.id,
    dayId: row.day_id,
    name: row.name,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    startTime: row.start_time,
    notes: row.notes,
    order: row.order,
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

export async function fetchTrip(tripId: string): Promise<Trip> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
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

export async function fetchStops(dayIds: string[]): Promise<Stop[]> {
  if (dayIds.length === 0) return []

  const { data, error } = await supabase
    .from('stops')
    .select('*')
    .in('day_id', dayIds)
    .order('order', { ascending: true })

  if (error) throw error
  return (data as StopRow[]).map(mapStop)
}

export async function createStop(input: {
  dayId: string
  name: string
  category: StopCategory
  lat: number
  lng: number
  startTime: string | null
  order: number
}): Promise<Stop> {
  const { data, error } = await supabase
    .from('stops')
    .insert({
      day_id: input.dayId,
      name: input.name,
      category: input.category,
      lat: input.lat,
      lng: input.lng,
      start_time: input.startTime,
      order: input.order,
    })
    .select()
    .single()

  if (error) throw error
  return mapStop(data as StopRow)
}

export async function updateStopOrder(stopId: string, order: number): Promise<void> {
  const { error } = await supabase.from('stops').update({ order }).eq('id', stopId)
  if (error) throw error
}
