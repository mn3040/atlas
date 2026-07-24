import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import {
  createItem,
  createTrip,
  fetchItems,
  fetchItemsForTrips,
  fetchTrip,
  fetchTrips,
  updateItem,
  updateTrip,
} from './trips'

interface QueryBuilder {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeQueryBuilder(result: { data?: unknown; error?: unknown }): QueryBuilder {
  const builder: Partial<QueryBuilder> = {}
  builder.select = vi.fn(() => builder as QueryBuilder)
  builder.order = vi.fn(() => Promise.resolve(result))
  builder.eq = vi.fn(() => builder as QueryBuilder)
  builder.in = vi.fn(() => builder as QueryBuilder)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.insert = vi.fn(() => builder as QueryBuilder)
  builder.update = vi.fn(() => builder as QueryBuilder)
  builder.delete = vi.fn(() => Promise.resolve(result))
  return builder as QueryBuilder
}

const tripRow = {
  id: 'trip-1',
  owner_id: 'user-1',
  name: 'Kyrgyzstan',
  description: null,
  country_code: 'KG',
  visibility: 'personal',
  member_limit: null,
  archived_at: null,
  start_date: '2026-03-01',
  end_date: '2026-03-10',
  created_at: '2026-01-01T00:00:00Z',
}

const itemRowBase = {
  id: 'item-1',
  day_id: null,
  type: 'activity',
  category: 'attraction',
  name: 'Osh Bazaar',
  notes: null,
  lat: 42.87,
  lng: 74.6,
  location_label: 'Osh Bazaar',
  country_code: 'KG',
  lat2: null,
  lng2: null,
  location2_label: null,
  start_date: '2026-03-02',
  end_date: null,
  start_time: '09:00',
  end_time: null,
  flight_number: null,
  price_label: null,
  photo_url: null,
  google_place_id: null,
  google_maps_url: null,
  google_rating: null,
  google_user_ratings_total: null,
  room_type: null,
  guests: null,
  nightly_rate: null,
  taxes_fees: null,
  confirmation_number: null,
  rating: null,
  position: 0,
}

beforeEach(() => {
  fromMock.mockReset()
})

describe('fetchTrips', () => {
  it('maps snake_case rows to camelCase Trip objects', async () => {
    const builder = makeQueryBuilder({ data: [tripRow], error: null })
    fromMock.mockReturnValue(builder)

    const trips = await fetchTrips()

    expect(fromMock).toHaveBeenCalledWith('trips')
    expect(trips).toEqual([
      {
        id: 'trip-1',
        ownerId: 'user-1',
        name: 'Kyrgyzstan',
        description: null,
        countryCode: 'KG',
        visibility: 'personal',
        memberLimit: null,
        archivedAt: null,
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ])
  })

  it('defaults visibility to "personal" when the column is null', async () => {
    const builder = makeQueryBuilder({ data: [{ ...tripRow, visibility: null }], error: null })
    fromMock.mockReturnValue(builder)

    const [trip] = await fetchTrips()
    expect(trip.visibility).toBe('personal')
  })

  it('throws when Supabase returns an error', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('network down') })
    fromMock.mockReturnValue(builder)

    await expect(fetchTrips()).rejects.toThrow('network down')
  })
})

describe('fetchTrip', () => {
  it('fetches a single trip by id', async () => {
    const builder = makeQueryBuilder({ data: tripRow, error: null })
    fromMock.mockReturnValue(builder)

    const trip = await fetchTrip('trip-1')
    expect(builder.eq).toHaveBeenCalledWith('id', 'trip-1')
    expect(trip.id).toBe('trip-1')
  })
})

describe('createTrip', () => {
  it('sends visibility and memberLimit on the first insert attempt', async () => {
    const builder = makeQueryBuilder({ data: tripRow, error: null })
    fromMock.mockReturnValue(builder)

    await createTrip({
      name: 'Kyrgyzstan',
      startDate: '2026-03-01',
      endDate: '2026-03-10',
      ownerId: 'user-1',
      visibility: 'group',
      memberLimit: 4,
    })

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'group', member_limit: 4 }),
    )
  })

  it('omits memberLimit when visibility is personal', async () => {
    const builder = makeQueryBuilder({ data: tripRow, error: null })
    fromMock.mockReturnValue(builder)

    await createTrip({
      name: 'Solo trip',
      startDate: '2026-03-01',
      endDate: '2026-03-10',
      ownerId: 'user-1',
      visibility: 'personal',
      memberLimit: 4,
    })

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ member_limit: null }))
  })

  it('retries with a reduced payload when the DB is missing optional columns', async () => {
    let callCount = 0
    fromMock.mockReturnValue({
      insert: () => {
        callCount += 1
        if (callCount === 1) {
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'column "visibility" does not exist' },
                }),
            }),
          }
        }
        return {
          select: () => ({ single: () => Promise.resolve({ data: tripRow, error: null }) }),
        }
      },
    })

    const trip = await createTrip({
      name: 'Kyrgyzstan',
      startDate: '2026-03-01',
      endDate: '2026-03-10',
      ownerId: 'user-1',
    })

    expect(callCount).toBe(2)
    expect(trip.id).toBe('trip-1')
  })

  it('does not retry and rethrows for an unrelated error', async () => {
    fromMock.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }),
        }),
      }),
    })

    await expect(
      createTrip({
        name: 'Kyrgyzstan',
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        ownerId: 'user-1',
      }),
    ).rejects.toBeTruthy()
  })
})

describe('updateTrip', () => {
  it('only includes explicitly provided fields in the patch', async () => {
    const builder = makeQueryBuilder({ data: tripRow, error: null })
    fromMock.mockReturnValue(builder)

    await updateTrip('trip-1', { name: 'New name' })

    expect(builder.update).toHaveBeenCalledWith({ name: 'New name' })
  })

  it('allows explicitly clearing a nullable field like description', async () => {
    const builder = makeQueryBuilder({ data: tripRow, error: null })
    fromMock.mockReturnValue(builder)

    await updateTrip('trip-1', { description: null })

    expect(builder.update).toHaveBeenCalledWith({ description: null })
  })
})

describe('fetchItems', () => {
  it('maps snake_case item rows to camelCase Item objects', async () => {
    const builder = makeQueryBuilder({ data: [{ ...itemRowBase, trip_id: 'trip-1' }], error: null })
    fromMock.mockReturnValue(builder)

    const items = await fetchItems('trip-1')
    expect(items[0].tripId).toBe('trip-1')
    expect(items[0].locationLabel).toBe('Osh Bazaar')
  })
})

describe('fetchItemsForTrips', () => {
  it('returns an empty object without querying Supabase when given no trip ids', async () => {
    const result = await fetchItemsForTrips([])
    expect(result).toEqual({})
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('groups items under their owning trip id', async () => {
    const data = [
      { ...itemRowBase, id: 'item-1', trip_id: 'trip-1' },
      { ...itemRowBase, id: 'item-2', trip_id: 'trip-2' },
      { ...itemRowBase, id: 'item-3', trip_id: 'trip-1' },
    ]
    const builder = makeQueryBuilder({ data, error: null })
    fromMock.mockReturnValue(builder)

    const result = await fetchItemsForTrips(['trip-1', 'trip-2'])

    expect(builder.in).toHaveBeenCalledWith('trip_id', ['trip-1', 'trip-2'])
    expect(result['trip-1'].map((i) => i.id)).toEqual(['item-1', 'item-3'])
    expect(result['trip-2'].map((i) => i.id)).toEqual(['item-2'])
  })

  it('includes an empty array for a requested trip id that has no items', async () => {
    const data = [{ ...itemRowBase, id: 'item-1', trip_id: 'trip-1' }]
    const builder = makeQueryBuilder({ data, error: null })
    fromMock.mockReturnValue(builder)

    const result = await fetchItemsForTrips(['trip-1', 'trip-empty'])

    expect(result['trip-empty']).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('boom') })
    fromMock.mockReturnValue(builder)

    await expect(fetchItemsForTrips(['trip-1'])).rejects.toThrow('boom')
  })
})

describe('createItem', () => {
  const baseInput = {
    tripId: 'trip-1',
    dayId: null,
    type: 'activity' as const,
    category: 'attraction' as const,
    name: 'Osh Bazaar',
    notes: null,
    lat: 42.87,
    lng: 74.6,
    locationLabel: 'Osh Bazaar',
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-03-02',
    endDate: null,
    startTime: '09:00',
    endTime: null,
    flightNumber: null,
    position: 0,
  }

  it('inserts the full payload including optional columns on the first attempt', async () => {
    const builder = makeQueryBuilder({ data: { ...itemRowBase, trip_id: 'trip-1' }, error: null })
    fromMock.mockReturnValue(builder)

    await createItem({ ...baseInput, countryCode: 'KG', rating: 4 })

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ country_code: 'KG', rating: 4 }),
    )
  })

  it('retries with a reduced payload when optional columns are missing', async () => {
    let callCount = 0
    fromMock.mockReturnValue({
      insert: (payload: Record<string, unknown>) => {
        callCount += 1
        if (callCount === 1) {
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: null, error: { message: 'column "room_type" does not exist' } }),
            }),
          }
        }
        expect(payload).not.toHaveProperty('room_type')
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { ...itemRowBase, trip_id: 'trip-1' }, error: null }),
          }),
        }
      },
    })

    const item = await createItem({ ...baseInput, roomType: 'Suite' })
    expect(callCount).toBe(2)
    expect(item.id).toBe('item-1')
  })
})

describe('updateItem', () => {
  it('builds a partial patch from only the provided fields', async () => {
    const builder = makeQueryBuilder({ data: { ...itemRowBase, trip_id: 'trip-1' }, error: null })
    fromMock.mockReturnValue(builder)

    await updateItem('item-1', { name: 'New name', notes: null })

    expect(builder.update).toHaveBeenCalledWith({ name: 'New name', notes: null })
  })

  it('omits fields that were not passed in the update input', async () => {
    const builder = makeQueryBuilder({ data: { ...itemRowBase, trip_id: 'trip-1' }, error: null })
    fromMock.mockReturnValue(builder)

    await updateItem('item-1', { rating: 5 })

    const patch = builder.update.mock.calls[0][0]
    expect(Object.keys(patch)).toEqual(['rating'])
  })
})
