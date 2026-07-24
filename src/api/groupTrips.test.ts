import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}))

import { createTripInvite, fetchTripInvites, fetchTripMembers, joinTripByToken, revokeTripInvite } from './groupTrips'

beforeEach(() => {
  fromMock.mockReset()
  rpcMock.mockReset()
})

describe('fetchTripMembers', () => {
  it('joins member rows with resolved profile display names/colors', async () => {
    const members = [
      { trip_id: 't1', user_id: 'u1', role: 'owner' },
      { trip_id: 't1', user_id: 'u2', role: 'editor' },
    ]
    const profiles = [{ user_id: 'u1', display_name: 'Alice', avatar_color: '#111' }]

    fromMock.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: members, error: null }) }) }),
    }))
    fromMock.mockImplementationOnce(() => ({
      select: () => ({ in: () => Promise.resolve({ data: profiles, error: null }) }),
    }))

    const result = await fetchTripMembers('t1')

    expect(result).toEqual([
      { tripId: 't1', userId: 'u1', role: 'owner', displayName: 'Alice', avatarColor: '#111' },
      { tripId: 't1', userId: 'u2', role: 'editor', displayName: 'Traveler', avatarColor: '#22dd85' },
    ])
  })

  it('skips the profile lookup entirely when there are no members', async () => {
    fromMock.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }))

    const result = await fetchTripMembers('t1')
    expect(result).toEqual([])
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the member query errors', async () => {
    fromMock.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }),
    }))
    await expect(fetchTripMembers('t1')).rejects.toThrow('boom')
  })
})

describe('fetchTripInvites', () => {
  it('only returns non-revoked invites, ordered newest first', async () => {
    const invites = [
      {
        id: 'inv1',
        trip_id: 't1',
        token: 'tok1',
        created_by: 'u1',
        expires_at: null,
        revoked_at: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ]
    const isMock = vi.fn(() => ({ order: () => Promise.resolve({ data: invites, error: null }) }))
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ is: isMock }) }) })

    const result = await fetchTripInvites('t1')
    expect(isMock).toHaveBeenCalledWith('revoked_at', null)
    expect(result[0].token).toBe('tok1')
  })
})

describe('createTripInvite', () => {
  it('creates an invite with an expiry roughly 30 days out', async () => {
    const insertMock = vi.fn((_payload: Record<string, unknown>) => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: {
              id: 'inv1',
              trip_id: 't1',
              token: 'abc123',
              created_by: 'u1',
              expires_at: '2026-02-01T00:00:00Z',
              revoked_at: null,
              created_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          }),
      }),
    }))
    fromMock.mockReturnValue({ insert: insertMock })

    await createTripInvite('t1', 'u1')

    const payload = insertMock.mock.calls[0][0] as { trip_id: string; created_by: string; token: string; expires_at: string }
    expect(payload.trip_id).toBe('t1')
    expect(payload.created_by).toBe('u1')
    expect(typeof payload.token).toBe('string')
    expect(payload.token.length).toBeGreaterThan(10)
    const expiresInDays = (new Date(payload.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(expiresInDays).toBeGreaterThan(29)
    expect(expiresInDays).toBeLessThan(31)
  })

  it('generates distinct tokens across calls', async () => {
    const insertMock = vi.fn((_payload: Record<string, unknown>) => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'inv', trip_id: 't1', token: 'x', created_by: 'u1', expires_at: null, revoked_at: null, created_at: '' }, error: null }),
      }),
    }))
    fromMock.mockReturnValue({ insert: insertMock })

    await createTripInvite('t1', 'u1')
    await createTripInvite('t1', 'u1')

    const tokenA = (insertMock.mock.calls[0][0] as { token: string }).token
    const tokenB = (insertMock.mock.calls[1][0] as { token: string }).token
    expect(tokenA).not.toBe(tokenB)
  })
})

describe('revokeTripInvite', () => {
  it('sets revoked_at on the given invite id', async () => {
    const eqMock = vi.fn(() => Promise.resolve({ error: null }))
    fromMock.mockReturnValue({ update: () => ({ eq: eqMock }) })

    await revokeTripInvite('inv1')
    expect(eqMock).toHaveBeenCalledWith('id', 'inv1')
  })
})

describe('joinTripByToken', () => {
  it('calls the join_trip_by_token RPC and returns its result', async () => {
    rpcMock.mockResolvedValue({ data: 'trip-1', error: null })

    const tripId = await joinTripByToken('some-token')

    expect(rpcMock).toHaveBeenCalledWith('join_trip_by_token', { invite_token: 'some-token' })
    expect(tripId).toBe('trip-1')
  })

  it('throws when the RPC errors (e.g. invalid/expired token)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('invalid token') })
    await expect(joinTripByToken('bad-token')).rejects.toThrow('invalid token')
  })
})
