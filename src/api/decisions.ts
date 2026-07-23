import { supabase } from './supabaseClient'
import type { ItemDecision } from '../types/trip'

interface ItemDecisionRow {
  trip_id: string
  day_id: string
  item_id: string
  decided_by: string
  decided_at: string
}

function mapDecision(row: ItemDecisionRow): ItemDecision {
  return {
    tripId: row.trip_id,
    dayId: row.day_id,
    itemId: row.item_id,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
  }
}

export function isMissingDecisionsTable(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return message.includes('item_decisions') || message.includes('schema cache') || message.includes('could not find the table')
}

export async function fetchItemDecisions(tripId: string): Promise<Record<string, ItemDecision>> {
  const { data, error } = await supabase
    .from('item_decisions')
    .select('trip_id,day_id,item_id,decided_by,decided_at')
    .eq('trip_id', tripId)

  if (error) {
    if (isMissingDecisionsTable(error)) return {}
    throw error
  }

  return (data as ItemDecisionRow[]).reduce<Record<string, ItemDecision>>((result, row) => {
    result[row.day_id] = mapDecision(row)
    return result
  }, {})
}

export async function setItemDecision(input: {
  tripId: string
  dayId: string
  itemId: string
  userId: string
}): Promise<ItemDecision> {
  const { data, error } = await supabase
    .from('item_decisions')
    .upsert(
      {
        trip_id: input.tripId,
        day_id: input.dayId,
        item_id: input.itemId,
        decided_by: input.userId,
        decided_at: new Date().toISOString(),
      },
      { onConflict: 'day_id' },
    )
    .select('trip_id,day_id,item_id,decided_by,decided_at')
    .single()

  if (error) throw error
  return mapDecision(data as ItemDecisionRow)
}

export async function clearItemDecision(dayId: string): Promise<void> {
  const { error } = await supabase.from('item_decisions').delete().eq('day_id', dayId)
  if (error) throw error
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error ?? '')
}
