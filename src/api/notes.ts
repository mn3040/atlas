import { supabase } from './supabaseClient'
import type { ItemNote } from '../types/trip'

interface ItemNoteRow {
  id: string
  trip_id: string
  item_id: string
  user_id: string
  body: string
  created_at: string
}

interface ProfileRow {
  user_id: string
  display_name: string
  avatar_color: string
}

export function isMissingNotesTable(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return message.includes('item_notes') || message.includes('schema cache') || message.includes('could not find the table')
}

export async function fetchItemNotes(tripId: string, viewerUserId: string | null): Promise<Record<string, ItemNote[]>> {
  const { data, error } = await supabase
    .from('item_notes')
    .select('id,trip_id,item_id,user_id,body,created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingNotesTable(error)) return {}
    throw error
  }

  const rows = (data ?? []) as ItemNoteRow[]
  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const profilesByUser = new Map<string, ProfileRow>()

  if (userIds.length > 0) {
    const profiles = await supabase.from('profiles').select('user_id,display_name,avatar_color').in('user_id', userIds)
    if (profiles.error) throw profiles.error
    for (const row of profiles.data as ProfileRow[]) {
      profilesByUser.set(row.user_id, row)
    }
  }

  return rows.reduce<Record<string, ItemNote[]>>((result, row) => {
    const profile = profilesByUser.get(row.user_id)
    const note: ItemNote = {
      id: row.id,
      tripId: row.trip_id,
      itemId: row.item_id,
      userId: row.user_id,
      displayName: profile?.display_name ?? (row.user_id === viewerUserId ? 'You' : 'Traveler'),
      avatarColor: profile?.avatar_color ?? '#22dd85',
      body: row.body,
      createdAt: row.created_at,
    }
    result[row.item_id] = [...(result[row.item_id] ?? []), note]
    return result
  }, {})
}

export async function addItemNote(input: {
  tripId: string
  itemId: string
  userId: string
  displayName: string
  avatarColor: string
  body: string
}): Promise<ItemNote> {
  const { data, error } = await supabase
    .from('item_notes')
    .insert({
      trip_id: input.tripId,
      item_id: input.itemId,
      user_id: input.userId,
      body: input.body,
    })
    .select('id,trip_id,item_id,user_id,body,created_at')
    .single()

  if (error) throw error
  const row = data as ItemNoteRow
  return {
    id: row.id,
    tripId: row.trip_id,
    itemId: row.item_id,
    userId: row.user_id,
    displayName: input.displayName,
    avatarColor: input.avatarColor,
    body: row.body,
    createdAt: row.created_at,
  }
}

export async function deleteItemNote(id: string): Promise<void> {
  const { error } = await supabase.from('item_notes').delete().eq('id', id)
  if (error) throw error
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error ?? '')
}
