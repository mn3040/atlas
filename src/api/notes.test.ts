import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import { addItemNote, deleteItemNote, fetchItemNotes, isMissingNotesTable } from './notes'

beforeEach(() => {
  fromMock.mockReset()
})

function noteQuery(result: { data?: unknown; error?: unknown }) {
  return {
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve(result),
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

describe('fetchItemNotes', () => {
  it('groups notes by item, ordered oldest-first, with resolved author profiles', async () => {
    const notes = [
      { id: 'n1', trip_id: 't1', item_id: 'i1', user_id: 'u1', body: 'First', created_at: '2026-01-01T00:00:00Z' },
      { id: 'n2', trip_id: 't1', item_id: 'i1', user_id: 'u2', body: 'Second', created_at: '2026-01-02T00:00:00Z' },
    ]
    const profiles = [{ user_id: 'u1', display_name: 'Alice', avatar_color: '#111' }]

    fromMock.mockImplementationOnce(() => noteQuery({ data: notes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: profiles, error: null }))

    const notesByItem = await fetchItemNotes('t1', 'u2')

    expect(notesByItem.i1).toHaveLength(2)
    expect(notesByItem.i1[0]).toEqual({
      id: 'n1',
      tripId: 't1',
      itemId: 'i1',
      userId: 'u1',
      displayName: 'Alice',
      avatarColor: '#111',
      body: 'First',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(notesByItem.i1[1].displayName).toBe('You')
  })

  it('falls back to "Traveler" for an unresolved author who is not the viewer', async () => {
    const notes = [{ id: 'n1', trip_id: 't1', item_id: 'i1', user_id: 'u3', body: 'Hi', created_at: '2026-01-01T00:00:00Z' }]
    fromMock.mockImplementationOnce(() => noteQuery({ data: notes, error: null }))
    fromMock.mockImplementationOnce(() => profileQuery({ data: [], error: null }))

    const notesByItem = await fetchItemNotes('t1', 'u2')
    expect(notesByItem.i1[0].displayName).toBe('Traveler')
  })

  it('does not query profiles when there are no notes', async () => {
    fromMock.mockImplementationOnce(() => noteQuery({ data: [], error: null }))

    const notesByItem = await fetchItemNotes('t1', null)
    expect(notesByItem).toEqual({})
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('returns an empty map when the item_notes table is missing', async () => {
    fromMock.mockImplementationOnce(() => noteQuery({ data: null, error: new Error('Could not find the table item_notes in schema cache') }))

    const notesByItem = await fetchItemNotes('t1', null)
    expect(notesByItem).toEqual({})
  })

  it('throws on other errors', async () => {
    fromMock.mockImplementationOnce(() => noteQuery({ data: null, error: new Error('permission denied') }))
    await expect(fetchItemNotes('t1', null)).rejects.toThrow('permission denied')
  })
})

describe('addItemNote', () => {
  it('inserts the note and returns it with the given display info', async () => {
    const singleMock = vi.fn(() =>
      Promise.resolve({
        data: { id: 'n1', trip_id: 't1', item_id: 'i1', user_id: 'u1', body: 'Hello', created_at: '2026-01-01T00:00:00Z' },
        error: null,
      }),
    )
    const selectMock = vi.fn(() => ({ single: singleMock }))
    const insertMock = vi.fn(() => ({ select: selectMock }))
    fromMock.mockReturnValue({ insert: insertMock })

    const note = await addItemNote({
      tripId: 't1',
      itemId: 'i1',
      userId: 'u1',
      displayName: 'You',
      avatarColor: '#22dd85',
      body: 'Hello',
    })

    expect(insertMock).toHaveBeenCalledWith({ trip_id: 't1', item_id: 'i1', user_id: 'u1', body: 'Hello' })
    expect(note).toEqual({
      id: 'n1',
      tripId: 't1',
      itemId: 'i1',
      userId: 'u1',
      displayName: 'You',
      avatarColor: '#22dd85',
      body: 'Hello',
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('throws when the insert fails', async () => {
    fromMock.mockReturnValue({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }) })

    await expect(
      addItemNote({ tripId: 't1', itemId: 'i1', userId: 'u1', displayName: 'You', avatarColor: '#22dd85', body: 'Hello' }),
    ).rejects.toThrow('boom')
  })
})

describe('deleteItemNote', () => {
  it('deletes the note by id', async () => {
    const eqMock = vi.fn(() => Promise.resolve({ error: null }))
    fromMock.mockReturnValue({ delete: () => ({ eq: eqMock }) })

    await deleteItemNote('n1')

    expect(fromMock).toHaveBeenCalledWith('item_notes')
    expect(eqMock).toHaveBeenCalledWith('id', 'n1')
  })

  it('throws when the delete fails', async () => {
    fromMock.mockReturnValue({ delete: () => ({ eq: () => Promise.resolve({ error: new Error('boom') }) }) })
    await expect(deleteItemNote('n1')).rejects.toThrow('boom')
  })
})

describe('isMissingNotesTable', () => {
  it('recognizes missing-table style errors', () => {
    expect(isMissingNotesTable(new Error('relation "item_notes" does not exist'))).toBe(true)
    expect(isMissingNotesTable(new Error('Could not find the table item_notes in schema cache'))).toBe(true)
    expect(isMissingNotesTable(new Error('permission denied for table trips'))).toBe(false)
  })
})
