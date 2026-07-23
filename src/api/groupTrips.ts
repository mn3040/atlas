import { supabase } from './supabaseClient'
import type { TripInvite, TripMemberWithProfile } from '../types/trip'

interface TripMemberRow {
  trip_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
}

interface ProfileRow {
  user_id: string
  display_name: string
  avatar_color: string
}

interface TripInviteRow {
  id: string
  trip_id: string
  token: string
  created_by: string
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

function mapInvite(row: TripInviteRow): TripInvite {
  return {
    id: row.id,
    tripId: row.trip_id,
    token: row.token,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }
}

export async function fetchTripMembers(tripId: string): Promise<TripMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id,user_id,role')
    .eq('trip_id', tripId)
    .order('role', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as TripMemberRow[]
  const userIds = rows.map((row) => row.user_id)
  const profilesByUser = new Map<string, ProfileRow>()

  if (userIds.length > 0) {
    const profiles = await supabase
      .from('profiles')
      .select('user_id,display_name,avatar_color')
      .in('user_id', userIds)

    if (profiles.error) throw profiles.error
    for (const row of profiles.data as ProfileRow[]) profilesByUser.set(row.user_id, row)
  }

  return rows.map((row) => {
    const profile = profilesByUser.get(row.user_id)
    return {
      tripId: row.trip_id,
      userId: row.user_id,
      role: row.role,
      displayName: profile?.display_name ?? 'Traveler',
      avatarColor: profile?.avatar_color ?? '#22dd85',
    }
  })
}

export async function fetchTripInvites(tripId: string): Promise<TripInvite[]> {
  const { data, error } = await supabase
    .from('trip_invites')
    .select('id,trip_id,token,created_by,expires_at,revoked_at,created_at')
    .eq('trip_id', tripId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as TripInviteRow[]).map(mapInvite)
}

export async function createTripInvite(tripId: string, userId: string): Promise<TripInvite> {
  const token = `${randomTokenPart()}${randomTokenPart().slice(0, 16)}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  const { data, error } = await supabase
    .from('trip_invites')
    .insert({
      trip_id: tripId,
      token,
      created_by: userId,
      expires_at: expiresAt,
    })
    .select('id,trip_id,token,created_by,expires_at,revoked_at,created_at')
    .single()

  if (error) throw error
  return mapInvite(data as TripInviteRow)
}

function randomTokenPart(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  const randomValues = new Uint32Array(4)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomValues)
    return Array.from(randomValues, (value) => value.toString(16).padStart(8, '0')).join('')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

export async function revokeTripInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('trip_invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId)
  if (error) throw error
}

export async function joinTripByToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_trip_by_token', { invite_token: token })
  if (error) throw error
  return data as string
}
