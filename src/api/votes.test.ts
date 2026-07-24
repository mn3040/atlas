import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import { fetchItemVoteSummary, setItemMustSeeVote } from './votes'

beforeEach(() => {
  fromMock.mockReset()
})

function voteQuery(result: { data?: unknown; error?: unknown }) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          order: () => Promise.resolve(result),
        }),
      }),
    }),
  }
}

function profileQuery(result: { data?: unknown; error?: unknown }) {
  return {
    select: () => ({
      in: () => Promise.resolve(result),
    }),
  }
}

describe('fetchItemVoteSummary', () => {
  it('groups votes by item and attaches resolved voter profiles', async () => {
    const votes = [
      { trip_id: 't1', item_id: 'i1', user_id: 'u1', vote: 'must_see', created_at: '2026-01-01T00:00:00Z' },
      { trip_id: 't1', item_id: 'i1', user_id: 'u2', vote: 'must_see', created_at: '2026-01-02T00:00:00Z' },
    ]
    const profiles = [{ user_id: 'u1', display_name: 'Alice', avatar_color: '#111' }]

    fromMock.mockImplementationOnce(() => voteQuery({ data: votes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: profiles, error: null }))

    const summary = await fetchItemVoteSummary('t1', 'u2')

    expect(summary.i1.voters).toHaveLength(2)
    expect(summary.i1.voters.find((v) => v.userId === 'u1')).toEqual({
      userId: 'u1',
      displayName: 'Alice',
      avatarColor: '#111',
    })
  })

  it('falls back to "You"/"Traveler" display names when no profile row exists', async () => {
    const votes = [{ trip_id: 't1', item_id: 'i1', user_id: 'u2', vote: 'must_see', created_at: '2026-01-01T00:00:00Z' }]
    fromMock.mockImplementationOnce(() => voteQuery({ data: votes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: [], error: null }))

    const summary = await fetchItemVoteSummary('t1', 'u2')
    expect(summary.i1.voters[0]).toEqual({ userId: 'u2', displayName: 'You', avatarColor: '#22dd85' })
  })

  it('uses "Traveler" for an unresolved voter who is not the viewer', async () => {
    const votes = [{ trip_id: 't1', item_id: 'i1', user_id: 'u3', vote: 'must_see', created_at: '2026-01-01T00:00:00Z' }]
    fromMock.mockImplementationOnce(() => voteQuery({ data: votes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: [], error: null }))

    const summary = await fetchItemVoteSummary('t1', 'u2')
    expect(summary.i1.voters[0].displayName).toBe('Traveler')
  })

  it('marks viewerVoted true only when the viewer is among the voters', async () => {
    const votes = [{ trip_id: 't1', item_id: 'i1', user_id: 'u1', vote: 'must_see', created_at: '2026-01-01T00:00:00Z' }]
    fromMock.mockImplementationOnce(() => voteQuery({ data: votes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: [], error: null }))

    const asViewer = await fetchItemVoteSummary('t1', 'u1')
    expect(asViewer.i1.viewerVoted).toBe(true)

    fromMock.mockImplementationOnce(() => voteQuery({ data: votes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: [], error: null }))
    const asOther = await fetchItemVoteSummary('t1', 'u9')
    expect(asOther.i1.viewerVoted).toBe(false)
  })

  it('does not query profiles at all when there are no votes', async () => {
    fromMock.mockImplementationOnce(() => voteQuery({ data: [], error: null }))

    const summary = await fetchItemVoteSummary('t1', null)
    expect(summary).toEqual({})
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the vote query errors', async () => {
    fromMock.mockImplementationOnce(() => voteQuery({ data: null, error: new Error('boom') }))
    await expect(fetchItemVoteSummary('t1', null)).rejects.toThrow('boom')
  })
})

describe('setItemMustSeeVote', () => {
  it('upserts a must_see vote on item_id,user_id when activating', async () => {
    const upsertMock = vi.fn(() => Promise.resolve({ error: null }))
    fromMock.mockReturnValue({ upsert: upsertMock })

    await setItemMustSeeVote({ tripId: 't1', itemId: 'i1', userId: 'u1', active: true })

    expect(upsertMock).toHaveBeenCalledWith(
      { trip_id: 't1', item_id: 'i1', user_id: 'u1', vote: 'must_see' },
      { onConflict: 'item_id,user_id' },
    )
  })

  it('deletes the vote by item_id and user_id when deactivating', async () => {
    const eqChain = { eq: vi.fn(() => Promise.resolve({ error: null })) }
    const firstEq = vi.fn(() => eqChain)
    fromMock.mockReturnValue({ delete: () => ({ eq: firstEq }) })

    await setItemMustSeeVote({ tripId: 't1', itemId: 'i1', userId: 'u1', active: false })

    expect(firstEq).toHaveBeenCalledWith('item_id', 'i1')
    expect(eqChain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('throws when the upsert fails', async () => {
    fromMock.mockReturnValue({ upsert: () => Promise.resolve({ error: new Error('boom') }) })
    await expect(setItemMustSeeVote({ tripId: 't1', itemId: 'i1', userId: 'u1', active: true })).rejects.toThrow('boom')
  })
})
