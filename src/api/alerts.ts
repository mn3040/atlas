import { supabase } from './supabaseClient'
import { expiryStatus } from '../utils/documentExpiry'

export type TripAlertType = 'expiring_document' | 'open_vote'

export interface TripAlert {
  tripId: string
  tripName: string
  type: TripAlertType
  message: string
  /** Path (relative to the trip) the alert should deep-link to. */
  link: string
}

export interface TripAlertSummary {
  expiringDocuments: number
  openVotes: number
  /** Structured, trip-scoped detail behind the counts above, for the alerts panel. */
  alerts: TripAlert[]
}

interface DocumentExpiryRow {
  trip_id: string
  expiry_date: string | null
}

interface ItemRow {
  id: string
  trip_id: string
  day_id: string | null
}

interface VoteRow {
  item_id: string
}

interface DecisionRow {
  day_id: string
}

function tripLabel(tripNames: Record<string, string>, tripId: string): string {
  return tripNames[tripId] ?? 'Trip'
}

async function fetchExpiringDocumentAlerts(
  tripIds: string[],
  tripNames: Record<string, string>,
): Promise<{ count: number; alerts: TripAlert[] }> {
  if (tripIds.length === 0) return { count: 0, alerts: [] }

  const { data, error } = await supabase.from('trip_documents').select('trip_id,expiry_date').in('trip_id', tripIds)
  if (error) return { count: 0, alerts: [] }

  const countByTrip = new Map<string, number>()
  for (const row of data as DocumentExpiryRow[]) {
    const tone = expiryStatus(row.expiry_date).tone
    if (tone !== 'expired' && tone !== 'soon') continue
    countByTrip.set(row.trip_id, (countByTrip.get(row.trip_id) ?? 0) + 1)
  }

  const alerts: TripAlert[] = [...countByTrip.entries()].map(([tripId, count]) => ({
    tripId,
    tripName: tripLabel(tripNames, tripId),
    type: 'expiring_document',
    message: count === 1 ? '1 document needs attention' : `${count} documents need attention`,
    link: `/trips/${tripId}/documents`,
  }))
  const total = [...countByTrip.values()].reduce((sum, n) => sum + n, 0)
  return { count: total, alerts }
}

/** Counts days that have at least one vote but no locked decision yet, across the given group trips. */
async function fetchOpenVoteAlerts(
  groupTripIds: string[],
  tripNames: Record<string, string>,
): Promise<{ count: number; alerts: TripAlert[] }> {
  if (groupTripIds.length === 0) return { count: 0, alerts: [] }

  const [itemsResult, votesResult, decisionsResult] = await Promise.all([
    supabase.from('items').select('id,trip_id,day_id').in('trip_id', groupTripIds),
    supabase.from('item_votes').select('item_id').eq('vote', 'must_see').in('trip_id', groupTripIds),
    supabase.from('item_decisions').select('day_id').in('trip_id', groupTripIds),
  ])
  if (itemsResult.error || votesResult.error || decisionsResult.error) return { count: 0, alerts: [] }

  const itemById = new Map<string, ItemRow>()
  for (const row of itemsResult.data as ItemRow[]) itemById.set(row.id, row)
  const decidedDayIds = new Set((decisionsResult.data as DecisionRow[]).map((row) => row.day_id))

  const openDaysByTrip = new Map<string, Set<string>>()
  for (const row of votesResult.data as VoteRow[]) {
    const item = itemById.get(row.item_id)
    if (!item?.day_id || decidedDayIds.has(item.day_id)) continue
    const openDays = openDaysByTrip.get(item.trip_id) ?? new Set<string>()
    openDays.add(item.day_id)
    openDaysByTrip.set(item.trip_id, openDays)
  }

  const alerts: TripAlert[] = [...openDaysByTrip.entries()].map(([tripId, openDays]) => ({
    tripId,
    tripName: tripLabel(tripNames, tripId),
    type: 'open_vote',
    message: openDays.size === 1 ? '1 day waiting on a group vote' : `${openDays.size} days waiting on a group vote`,
    link: `/trips/${tripId}/itinerary`,
  }))
  const total = [...openDaysByTrip.values()].reduce((sum, openDays) => sum + openDays.size, 0)
  return { count: total, alerts }
}

/**
 * Rolls up the same "needs attention" signals the Command tab shows for one
 * trip into a single count across every active trip, for the persistent
 * profile badge in TopNav. `tripNames` is optional and only used to label
 * the structured `alerts` list the badge's popover renders -- omit it and
 * the counts still work exactly as before.
 */
export async function fetchTripAlertSummary(
  activeTripIds: string[],
  groupTripIds: string[],
  tripNames: Record<string, string> = {},
): Promise<TripAlertSummary> {
  const [documentResult, voteResult] = await Promise.all([
    fetchExpiringDocumentAlerts(activeTripIds, tripNames),
    fetchOpenVoteAlerts(groupTripIds, tripNames),
  ])
  return {
    expiringDocuments: documentResult.count,
    openVotes: voteResult.count,
    alerts: [...documentResult.alerts, ...voteResult.alerts],
  }
}
