import { supabase } from './supabaseClient'
import type { ItemVoteSummary, VoteProfile } from '../types/trip'

interface ItemVoteRow {
  trip_id: string
  item_id: string
  user_id: string
  vote: 'must_see'
  created_at: string
}

interface ProfileRow {
  user_id: string
  display_name: string
  avatar_color: string
}

function mapProfile(row: ProfileRow): VoteProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
  }
}

export async function fetchItemVoteSummary(tripId: string, viewerUserId: string | null): Promise<Record<string, ItemVoteSummary>> {
  const { data, error } = await supabase
    .from('item_votes')
    .select('trip_id,item_id,user_id,vote,created_at')
    .eq('trip_id', tripId)
    .eq('vote', 'must_see')
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as ItemVoteRow[]
  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const profilesByUser = new Map<string, VoteProfile>()

  if (userIds.length > 0) {
    const profiles = await supabase
      .from('profiles')
      .select('user_id,display_name,avatar_color')
      .in('user_id', userIds)

    if (profiles.error) throw profiles.error
    for (const row of profiles.data as ProfileRow[]) {
      profilesByUser.set(row.user_id, mapProfile(row))
    }
  }

  return rows.reduce<Record<string, ItemVoteSummary>>((summary, row) => {
    const current = summary[row.item_id] ?? {
      itemId: row.item_id,
      voters: [],
      viewerVoted: false,
    }
    current.voters.push(
      profilesByUser.get(row.user_id) ?? {
        userId: row.user_id,
        displayName: row.user_id === viewerUserId ? 'You' : 'Traveler',
        avatarColor: '#22dd85',
      },
    )
    current.viewerVoted = current.viewerVoted || row.user_id === viewerUserId
    summary[row.item_id] = current
    return summary
  }, {})
}

export async function setItemMustSeeVote(input: {
  tripId: string
  itemId: string
  userId: string
  active: boolean
}): Promise<void> {
  if (input.active) {
    const { error } = await supabase.from('item_votes').upsert(
      {
        trip_id: input.tripId,
        item_id: input.itemId,
        user_id: input.userId,
        vote: 'must_see',
      },
      { onConflict: 'item_id,user_id' },
    )
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('item_votes')
    .delete()
    .eq('item_id', input.itemId)
    .eq('user_id', input.userId)

  if (error) throw error
}
