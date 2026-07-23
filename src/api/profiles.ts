import { supabase } from './supabaseClient'
import type { Profile } from '../types/trip'

interface ProfileRow {
  user_id: string
  display_name: string
  avatar_color: string
  created_at: string
  updated_at: string
}

const DEFAULT_PROFILE = {
  displayName: 'Traveler',
  avatarColor: '#22dd85',
}

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchOrCreateProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return mapProfile(data as ProfileRow)

  const created = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      display_name: DEFAULT_PROFILE.displayName,
      avatar_color: DEFAULT_PROFILE.avatarColor,
    })
    .select()
    .single()

  if (created.error) throw created.error
  return mapProfile(created.data as ProfileRow)
}

export async function updateProfile(
  userId: string,
  input: { displayName: string; avatarColor: string },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName.trim() || DEFAULT_PROFILE.displayName,
      avatar_color: input.avatarColor,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return mapProfile(data as ProfileRow)
}
