import { supabase } from './supabaseClient'
import type { PackingCategory, PackingItem } from '../types/trip'

interface PackingItemRow {
  id: string
  trip_id: string
  label: string
  category: PackingCategory
  packed: boolean
  created_by: string
  created_at: string
}

const SELECT_COLUMNS = 'id,trip_id,label,category,packed,created_by,created_at'

function mapPackingItem(row: PackingItemRow): PackingItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    label: row.label,
    category: row.category,
    packed: row.packed,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function isMissingPackingTable(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return (
    message.includes('packing_items') ||
    message.includes('schema cache') ||
    message.includes('could not find the table')
  )
}

export async function fetchPackingItems(tripId: string): Promise<PackingItem[]> {
  const { data, error } = await supabase
    .from('packing_items')
    .select(SELECT_COLUMNS)
    .eq('trip_id', tripId)
    .order('category', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as PackingItemRow[]).map(mapPackingItem)
}

export interface PackingItemInput {
  label: string
  category: PackingCategory
}

export async function createPackingItem(tripId: string, userId: string, input: PackingItemInput): Promise<PackingItem> {
  const { data, error } = await supabase
    .from('packing_items')
    .insert({ trip_id: tripId, label: input.label, category: input.category, created_by: userId })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error
  return mapPackingItem(data as PackingItemRow)
}

/** Bulk insert used by the "Suggest items" seeding flow. */
export async function createPackingItems(tripId: string, userId: string, inputs: PackingItemInput[]): Promise<PackingItem[]> {
  if (inputs.length === 0) return []

  const { data, error } = await supabase
    .from('packing_items')
    .insert(inputs.map((input) => ({ trip_id: tripId, label: input.label, category: input.category, created_by: userId })))
    .select(SELECT_COLUMNS)

  if (error) throw error
  return (data as PackingItemRow[]).map(mapPackingItem)
}

export async function setPackingItemPacked(itemId: string, packed: boolean): Promise<void> {
  const { error } = await supabase.from('packing_items').update({ packed }).eq('id', itemId)
  if (error) throw error
}

export async function deletePackingItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('packing_items').delete().eq('id', itemId)
  if (error) throw error
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error ?? '')
}
