import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import { clearItemDecision, fetchItemDecisions, isMissingDecisionsTable, setItemDecision } from './decisions'

function makeSelectBuilder(result: { data?: unknown; error?: unknown }) {
  return {
    select: () => ({ eq: () => Promise.resolve(result) }),
  }
}

beforeEach(() => {
  fromMock.mockReset()
})

describe('isMissingDecisionsTable', () => {
  it('recognizes a missing-table Postgres error by message content', () => {
    expect(isMissingDecisionsTable({ message: 'relation "item_decisions" does not exist' })).toBe(true)
    expect(isMissingDecisionsTable({ message: 'schema cache reload needed' })).toBe(true)
    expect(isMissingDecisionsTable({ message: 'Could not find the table in schema' })).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isMissingDecisionsTable({ message: 'permission denied' })).toBe(false)
    expect(isMissingDecisionsTable(new Error('network error'))).toBe(false)
    expect(isMissingDecisionsTable(null)).toBe(false)
  })
})

describe('fetchItemDecisions', () => {
  it('maps rows into a record keyed by dayId', () => {
    const rows = [
      { trip_id: 't1', day_id: 'd1', item_id: 'i1', decided_by: 'u1', decided_at: '2026-01-01T00:00:00Z' },
      { trip_id: 't1', day_id: 'd2', item_id: 'i2', decided_by: 'u2', decided_at: '2026-01-02T00:00:00Z' },
    ]
    fromMock.mockReturnValue(makeSelectBuilder({ data: rows, error: null }))

    return fetchItemDecisions('t1').then((result) => {
      expect(Object.keys(result)).toEqual(['d1', 'd2'])
      expect(result.d1).toEqual({
        tripId: 't1',
        dayId: 'd1',
        itemId: 'i1',
        decidedBy: 'u1',
        decidedAt: '2026-01-01T00:00:00Z',
      })
    })
  })

  it('returns an empty object instead of throwing when the table is missing', async () => {
    fromMock.mockReturnValue(
      makeSelectBuilder({ data: null, error: { message: 'relation "item_decisions" does not exist' } }),
    )
    await expect(fetchItemDecisions('t1')).resolves.toEqual({})
  })

  it('rethrows unrelated errors', async () => {
    fromMock.mockReturnValue(makeSelectBuilder({ data: null, error: { message: 'permission denied' } }))
    await expect(fetchItemDecisions('t1')).rejects.toBeTruthy()
  })
})

describe('setItemDecision', () => {
  it('upserts on day_id and returns the mapped decision', async () => {
    const upsertMock = vi.fn(() => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { trip_id: 't1', day_id: 'd1', item_id: 'i1', decided_by: 'u1', decided_at: '2026-01-01T00:00:00Z' },
            error: null,
          }),
      }),
    }))
    fromMock.mockReturnValue({ upsert: upsertMock })

    const decision = await setItemDecision({ tripId: 't1', dayId: 'd1', itemId: 'i1', userId: 'u1' })

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: 't1', day_id: 'd1', item_id: 'i1', decided_by: 'u1' }),
      { onConflict: 'day_id' },
    )
    expect(decision.dayId).toBe('d1')
  })
})

describe('clearItemDecision', () => {
  it('deletes by day_id', async () => {
    const eqMock = vi.fn(() => Promise.resolve({ error: null }))
    fromMock.mockReturnValue({ delete: () => ({ eq: eqMock }) })

    await clearItemDecision('d1')
    expect(eqMock).toHaveBeenCalledWith('day_id', 'd1')
  })

  it('throws when Supabase returns an error', async () => {
    fromMock.mockReturnValue({ delete: () => ({ eq: () => Promise.resolve({ error: new Error('boom') }) }) })
    await expect(clearItemDecision('d1')).rejects.toThrow('boom')
  })
})
