import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { authMocks, fromMock } = vi.hoisted(() => ({
  authMocks: {
    getSession: vi.fn(),
    signInAnonymously: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  fromMock: vi.fn(),
}))

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: authMocks,
    from: fromMock,
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../api/profiles', () => ({
  fetchOrCreateProfile: vi.fn().mockResolvedValue({
    userId: 'user-1',
    displayName: 'Traveler',
    avatarColor: '#22dd85',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }),
  updateProfile: vi.fn(),
}))

const tripsMocks = vi.hoisted(() => ({
  fetchTrips: vi.fn(),
  fetchTrip: vi.fn(),
  fetchDays: vi.fn(),
  fetchItems: vi.fn(),
  updateItemPosition: vi.fn(),
  updateDayLabel: vi.fn(),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  deleteItem: vi.fn(),
  createDay: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
}))

vi.mock('../api/trips', () => tripsMocks)

vi.mock('../api/alerts', () => ({
  fetchTripAlertSummary: vi.fn().mockResolvedValue({ expiringDocuments: 0, openVotes: 0 }),
}))

vi.mock('../api/decisions', () => ({
  isMissingDecisionsTable: vi.fn().mockReturnValue(false),
  fetchItemDecisions: vi.fn().mockResolvedValue({}),
  setItemDecision: vi.fn(),
  clearItemDecision: vi.fn(),
}))

vi.mock('../api/votes', () => ({
  fetchItemVoteSummary: vi.fn().mockResolvedValue({}),
  setItemMustSeeVote: vi.fn(),
}))

vi.mock('../api/weather', () => ({
  fetchWeatherForPoint: vi.fn().mockResolvedValue(null),
}))

vi.mock('../maps/TripMap', () => ({
  TripMap: forwardRef(function TripMapMock(_props: unknown, _ref: unknown) {
    return <div data-testid="trip-map-mock" />
  }),
}))

import TripDetail from './TripDetail'
import type { Day, Item, Trip } from '../types/trip'

const fakeSession = { user: { id: 'user-1' } }

const trip: Trip = {
  id: 'trip-1',
  ownerId: 'user-1',
  name: 'Kyrgyzstan Trip',
  description: 'Mountains and lakes',
  countryCode: 'KG',
  visibility: 'personal',
  memberLimit: null,
  archivedAt: null,
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  createdAt: '2026-01-01T00:00:00Z',
}

const days: Day[] = [
  { id: 'day-1', tripId: 'trip-1', date: '2026-03-01', label: null },
  { id: 'day-2', tripId: 'trip-1', date: '2026-03-02', label: null },
]

function makeItem(overrides: Partial<Item> & Pick<Item, 'id' | 'dayId' | 'name'>): Item {
  return {
    tripId: 'trip-1',
    type: 'activity',
    category: 'attraction',
    notes: null,
    lat: 42.87,
    lng: 74.6,
    locationLabel: 'Osh Bazaar, Osh, Kyrgyzstan',
    countryCode: 'KG',
    lat2: null,
    lng2: null,
    location2Label: null,
    startDate: '2026-03-01',
    endDate: null,
    startTime: '09:00',
    endTime: null,
    flightNumber: null,
    priceLabel: null,
    photoUrl: null,
    googlePlaceId: null,
    googleMapsUrl: null,
    googleRating: null,
    googleUserRatingsTotal: null,
    roomType: null,
    guests: null,
    nightlyRate: null,
    taxesFees: null,
    confirmationNumber: null,
    rating: null,
    position: 0,
    ...overrides,
  }
}

function renderTripDetail() {
  return render(
    <MemoryRouter initialEntries={['/trips/trip-1']}>
      <Routes>
        <Route path="/trips/:tripId" element={<TripDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  authMocks.getSession.mockReset().mockResolvedValue({ data: { session: fakeSession } })
  authMocks.signInAnonymously.mockReset().mockResolvedValue({ data: { session: fakeSession }, error: null })
  authMocks.onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  fromMock.mockReset()

  Object.values(tripsMocks).forEach((mockFn) => mockFn.mockReset())
  tripsMocks.fetchTrips.mockResolvedValue([])

  window.localStorage.clear()
})

describe('TripDetail', () => {
  it('renders the trip header and an empty-day message when there are no items', async () => {
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue([days[0]])
    tripsMocks.fetchItems.mockResolvedValue([])

    renderTripDetail()

    expect(await screen.findByRole('heading', { name: 'Kyrgyzstan Trip' })).toBeInTheDocument()
    expect(screen.getByText(/1 day/)).toBeInTheDocument()
    expect(screen.getByText('Nothing planned yet.')).toBeInTheDocument()
  })

  it('renders itinerary items for the active day', async () => {
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue([days[0]])
    tripsMocks.fetchItems.mockResolvedValue([makeItem({ id: 'item-1', dayId: 'day-1', name: 'Osh Bazaar walk' })])

    renderTripDetail()

    expect(await screen.findByText('Osh Bazaar walk')).toBeInTheDocument()
  })

  it('switches to the next day and shows that day items', async () => {
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue(days)
    tripsMocks.fetchItems.mockResolvedValue([
      makeItem({ id: 'item-1', dayId: 'day-1', name: 'Osh Bazaar walk' }),
      makeItem({ id: 'item-2', dayId: 'day-2', name: 'Sary-Chelek hike', startDate: '2026-03-02' }),
    ])

    renderTripDetail()
    await screen.findByText('Osh Bazaar walk')

    await userEvent.click(screen.getByRole('button', { name: /next day/i }))

    expect(await screen.findByText('Sary-Chelek hike')).toBeInTheDocument()
    expect(screen.queryByText('Osh Bazaar walk')).not.toBeInTheDocument()
  })

  it('deletes an item immediately when confirm-before-delete is disabled', async () => {
    window.localStorage.setItem('atlas:settings', JSON.stringify({ confirmBeforeDelete: false }))
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue([days[0]])
    tripsMocks.fetchItems.mockResolvedValue([makeItem({ id: 'item-1', dayId: 'day-1', name: 'Osh Bazaar walk' })])
    tripsMocks.deleteItem.mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm')

    renderTripDetail()
    await screen.findByText('Osh Bazaar walk')

    await userEvent.click(screen.getByRole('button', { name: /remove osh bazaar walk/i }))

    await waitFor(() => expect(tripsMocks.deleteItem).toHaveBeenCalledWith('item-1'))
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('asks for confirmation before deleting an item and aborts on cancel', async () => {
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue([days[0]])
    tripsMocks.fetchItems.mockResolvedValue([makeItem({ id: 'item-1', dayId: 'day-1', name: 'Osh Bazaar walk' })])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderTripDetail()
    await screen.findByText('Osh Bazaar walk')

    await userEvent.click(screen.getByRole('button', { name: /remove osh bazaar walk/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(tripsMocks.deleteItem).not.toHaveBeenCalled()
    expect(screen.getByText('Osh Bazaar walk')).toBeInTheDocument()
  })
})
