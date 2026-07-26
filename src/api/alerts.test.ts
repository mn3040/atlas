import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import { fetchTripAlertSummary } from './alerts'

function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.in = vi.fn(() => Promise.resolve(result))
  return builder
}

beforeEach(() => {
  fromMock.mockReset()
})

describe('fetchTripAlertSummary', () => {
  it('returns zero counts when there are no active or group trips', async () => {
    const summary = await fetchTripAlertSummary([], [])
    expect(summary).toEqual({ expiringDocuments: 0, openVotes: 0, alerts: [] })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('counts documents that are expired or expiring soon, ignoring ones with plenty of runway', async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    const farOut = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10)
    const expired = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)

    fromMock.mockImplementation((table: string) => {
      if (table === 'trip_documents') {
        return makeQueryBuilder({
          data: [
            { trip_id: 'trip-1', expiry_date: soon },
            { trip_id: 'trip-1', expiry_date: farOut },
            { trip_id: 'trip-1', expiry_date: expired },
            { trip_id: 'trip-1', expiry_date: null },
          ],
          error: null,
        })
      }
      return makeQueryBuilder({ data: [], error: null })
    })

    const summary = await fetchTripAlertSummary(['trip-1'], [], { 'trip-1': 'Kyrgyzstan Trip' })
    expect(summary.expiringDocuments).toBe(2)
    expect(summary.alerts).toEqual([
      { tripId: 'trip-1', tripName: 'Kyrgyzstan Trip', type: 'expiring_document', message: '2 documents need attention', link: '/trips/trip-1/documents' },
    ])
  })

  it('counts distinct days that have a vote but no locked decision, across group trips', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'items') {
        return makeQueryBuilder({
          data: [
            { id: 'item-1', trip_id: 'trip-1', day_id: 'day-1' },
            { id: 'item-2', trip_id: 'trip-1', day_id: 'day-1' },
            { id: 'item-3', trip_id: 'trip-1', day_id: 'day-2' },
            { id: 'item-4', trip_id: 'trip-1', day_id: 'day-3' },
          ],
          error: null,
        })
      }
      if (table === 'item_votes') {
        return makeQueryBuilder({
          data: [{ item_id: 'item-1' }, { item_id: 'item-2' }, { item_id: 'item-3' }],
          error: null,
        })
      }
      if (table === 'item_decisions') {
        return makeQueryBuilder({ data: [{ day_id: 'day-2' }], error: null })
      }
      return makeQueryBuilder({ data: [], error: null })
    })

    const summary = await fetchTripAlertSummary([], ['trip-1'], { 'trip-1': 'Kyrgyzstan Trip' })
    // day-1 has votes and no decision (counts once, even with 2 voted items).
    // day-2 has a vote but is already decided. day-3 has no votes at all.
    expect(summary.openVotes).toBe(1)
    expect(summary.alerts).toEqual([
      { tripId: 'trip-1', tripName: 'Kyrgyzstan Trip', type: 'open_vote', message: '1 day waiting on a group vote', link: '/trips/trip-1/itinerary' },
    ])
  })

  it('treats a query error as zero rather than throwing, since this is a best-effort badge', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: new Error('boom') }))

    const summary = await fetchTripAlertSummary(['trip-1'], ['trip-1'])
    expect(summary).toEqual({ expiringDocuments: 0, openVotes: 0, alerts: [] })
  })
})
