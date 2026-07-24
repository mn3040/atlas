import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import {
  createPackingItem,
  createPackingItems,
  deletePackingItem,
  fetchPackingItems,
  isMissingPackingTable,
  setPackingItemPacked,
} from './packing'

function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  ;(builder as unknown as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return builder
}

const packingRow = {
  id: 'packing-1',
  trip_id: 'trip-1',
  label: 'Passport / ID',
  category: 'documents',
  packed: false,
  created_by: 'user-1',
  created_at: '2026-03-02T00:00:00Z',
}

const mappedPackingItem = {
  id: 'packing-1',
  tripId: 'trip-1',
  label: 'Passport / ID',
  category: 'documents',
  packed: false,
  createdBy: 'user-1',
  createdAt: '2026-03-02T00:00:00Z',
}

beforeEach(() => {
  fromMock.mockReset()
})

describe('fetchPackingItems', () => {
  it('maps snake_case rows to camelCase PackingItem objects', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [packingRow], error: null }))

    const items = await fetchPackingItems('trip-1')

    expect(fromMock).toHaveBeenCalledWith('packing_items')
    expect(items).toEqual([mappedPackingItem])
  })

  it('throws when the query errors', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: new Error('boom') }))

    await expect(fetchPackingItems('trip-1')).rejects.toThrow('boom')
  })
})

describe('createPackingItem', () => {
  it('inserts a single item scoped to the trip and user', async () => {
    const builder = makeQueryBuilder({ data: packingRow, error: null })
    fromMock.mockReturnValueOnce(builder)

    const result = await createPackingItem('trip-1', 'user-1', { label: 'Passport / ID', category: 'documents' })

    expect(fromMock).toHaveBeenCalledWith('packing_items')
    expect(builder.insert).toHaveBeenCalledWith({
      trip_id: 'trip-1',
      label: 'Passport / ID',
      category: 'documents',
      created_by: 'user-1',
    })
    expect(result).toEqual(mappedPackingItem)
  })

  it('throws when the insert errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('insert failed') }))

    await expect(createPackingItem('trip-1', 'user-1', { label: 'Passport / ID', category: 'documents' })).rejects.toThrow(
      'insert failed',
    )
  })
})

describe('createPackingItems', () => {
  it('bulk inserts suggested items for the trip', async () => {
    const builder = makeQueryBuilder({ data: [packingRow], error: null })
    fromMock.mockReturnValueOnce(builder)

    const result = await createPackingItems('trip-1', 'user-1', [{ label: 'Passport / ID', category: 'documents' }])

    expect(builder.insert).toHaveBeenCalledWith([
      { trip_id: 'trip-1', label: 'Passport / ID', category: 'documents', created_by: 'user-1' },
    ])
    expect(result).toEqual([mappedPackingItem])
  })

  it('skips the request entirely when there are no inputs', async () => {
    const result = await createPackingItems('trip-1', 'user-1', [])

    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('setPackingItemPacked', () => {
  it('updates the packed flag by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValueOnce(builder)

    await setPackingItemPacked('packing-1', true)

    expect(fromMock).toHaveBeenCalledWith('packing_items')
    expect(builder.update).toHaveBeenCalledWith({ packed: true })
    expect(builder.eq).toHaveBeenCalledWith('id', 'packing-1')
  })

  it('throws when the update errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('update failed') }))

    await expect(setPackingItemPacked('packing-1', true)).rejects.toThrow('update failed')
  })
})

describe('deletePackingItem', () => {
  it('deletes the item by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValueOnce(builder)

    await deletePackingItem('packing-1')

    expect(fromMock).toHaveBeenCalledWith('packing_items')
    expect(builder.delete).toHaveBeenCalled()
  })

  it('throws when the delete errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('delete failed') }))

    await expect(deletePackingItem('packing-1')).rejects.toThrow('delete failed')
  })
})

describe('isMissingPackingTable', () => {
  it('recognizes missing-table style errors', () => {
    expect(isMissingPackingTable(new Error('relation "packing_items" does not exist'))).toBe(true)
    expect(isMissingPackingTable(new Error('Could not find the table packing_items in schema cache'))).toBe(true)
    expect(isMissingPackingTable(new Error('permission denied for table trips'))).toBe(false)
  })
})
