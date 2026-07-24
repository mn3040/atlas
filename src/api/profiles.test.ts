import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import { fetchOrCreateProfile, updateProfile } from './profiles'

beforeEach(() => {
  fromMock.mockReset()
})

const profileRow = {
  user_id: 'u1',
  display_name: 'Alice',
  avatar_color: '#111',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('fetchOrCreateProfile', () => {
  it('returns the existing profile without inserting when one is found', async () => {
    const insertMock = vi.fn()
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: profileRow, error: null }) }) }),
      insert: insertMock,
    })

    const profile = await fetchOrCreateProfile('u1')

    expect(profile.displayName).toBe('Alice')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('creates a default profile when none exists yet', async () => {
    const insertMock = vi.fn(() => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { ...profileRow, display_name: 'Traveler', avatar_color: '#22dd85' },
            error: null,
          }),
      }),
    }))
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: insertMock,
    })

    const profile = await fetchOrCreateProfile('u1')

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', display_name: 'Traveler', avatar_color: '#22dd85' }),
    )
    expect(profile.displayName).toBe('Traveler')
  })

  it('throws when the initial select errors', async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }),
    })
    await expect(fetchOrCreateProfile('u1')).rejects.toThrow('boom')
  })

  it('throws when the insert fails', async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('insert failed') }) }) }),
    })
    await expect(fetchOrCreateProfile('u1')).rejects.toThrow('insert failed')
  })
})

describe('updateProfile', () => {
  it('trims the display name and updates the row', async () => {
    const updateMock = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: profileRow, error: null }) }) }),
    }))
    fromMock.mockReturnValue({ update: updateMock })

    await updateProfile('u1', { displayName: '  Alice  ', avatarColor: '#111' })

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Alice', avatar_color: '#111' }),
    )
  })

  it('falls back to "Traveler" when the trimmed display name is empty', async () => {
    const updateMock = vi.fn(() => ({
      eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: profileRow, error: null }) }) }),
    }))
    fromMock.mockReturnValue({ update: updateMock })

    await updateProfile('u1', { displayName: '   ', avatarColor: '#111' })

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Traveler' }))
  })

  it('throws when the update fails', async () => {
    fromMock.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }) }),
    })
    await expect(updateProfile('u1', { displayName: 'Alice', avatarColor: '#111' })).rejects.toThrow('boom')
  })
})
