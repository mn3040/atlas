import { supabase } from './supabaseClient'
import { expiryStatus } from '../utils/documentExpiry'

export interface TripAlertSummary {
  expiringDocuments: number
  openVotes: number
}

interface DocumentExpiryRow {
  expiry_date: string | null
}

interface ItemDayRow {
  id: string
  day_id: string | null
}

interface VoteRow {
  item_id: string
}

interface DecisionRow {
  day_id: string
}

async function fetchExpiringDocumentCount(tripIds: string[]): Promise<number> {
  if (tripIds.length === 0) return 0

  const { data, error } = await supabase.from('trip_documents').select('expiry_date').in('trip_id', tripIds)
  if (error) return 0

  return (data as DocumentExpiryRow[]).filter((row) => {
    const tone = expiryStatus(row.expiry_date).tone
    return tone === 'expired' || tone === 'soon'
  }).length
}

/** Counts days that have at least one vote but no locked decision yet, across the given group trips. */
async function fetchOpenVoteCount(groupTripIds: string[]): Promise<number> {
  if (groupTripIds.length === 0) return 0

  const [itemsResult, votesResult, decisionsResult] = await Promise.all([
    supabase.from('items').select('id,day_id').in('trip_id', groupTripIds),
    supabase.from('item_votes').select('item_id').eq('vote', 'must_see').in('trip_id', groupTripIds),
    supabase.from('item_decisions').select('day_id').in('trip_id', groupTripIds),
  ])
  if (itemsResult.error || votesResult.error || decisionsResult.error) return 0

  const dayIdByItemId = new Map<string, string>()
  for (const row of itemsResult.data as ItemDayRow[]) {
    if (row.day_id) dayIdByItemId.set(row.id, row.day_id)
  }
  const decidedDayIds = new Set((decisionsResult.data as DecisionRow[]).map((row) => row.day_id))

  const openDayIds = new Set<string>()
  for (const row of votesResult.data as VoteRow[]) {
    const dayId = dayIdByItemId.get(row.item_id)
    if (dayId && !decidedDayIds.has(dayId)) openDayIds.add(dayId)
  }
  return openDayIds.size
}

/**
 * Rolls up the same "needs attention" signals the Command tab shows for one
 * trip into a single count across every active trip, for the persistent
 * profile badge in TopNav. Deliberately a count, not a feed -- Atlas isn't
 * building a notifications inbox.
 */
export async function fetchTripAlertSummary(activeTripIds: string[], groupTripIds: string[]): Promise<TripAlertSummary> {
  const [expiringDocuments, openVotes] = await Promise.all([
    fetchExpiringDocumentCount(activeTripIds),
    fetchOpenVoteCount(groupTripIds),
  ])
  return { expiringDocuments, openVotes }
}
