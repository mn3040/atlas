import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
  fetchTrip: vi.fn(),
  fetchDays: vi.fn(),
  fetchItems: vi.fn(),
  fetchTrips: vi.fn().mockResolvedValue([]),
}))

vi.mock('../api/trips', () => tripsMocks)

vi.mock('../api/alerts', () => ({
  fetchTripAlertSummary: vi.fn().mockResolvedValue({ expiringDocuments: 0, openVotes: 0 }),
}))

vi.mock('../api/groupTrips', () => ({
  fetchTripMembers: vi.fn().mockResolvedValue([]),
}))

vi.mock('../api/budget', () => ({
  fetchExpenses: vi.fn().mockResolvedValue([]),
  isMissingExpensesTable: vi.fn().mockReturnValue(false),
}))

vi.mock('../api/documents', () => ({
  fetchDocuments: vi.fn().mockResolvedValue([]),
  isMissingDocumentsTable: vi.fn().mockReturnValue(false),
}))

vi.mock('../api/packing', () => ({
  fetchPackingItems: vi.fn().mockResolvedValue([]),
  isMissingPackingTable: vi.fn().mockReturnValue(false),
}))

vi.mock('../api/votes', () => ({
  fetchItemVoteSummary: vi.fn().mockResolvedValue({}),
}))

vi.mock('../api/decisions', () => ({
  fetchItemDecisions: vi.fn().mockResolvedValue({}),
}))

vi.mock('../api/weather', () => ({
  fetchWeatherForPoint: vi.fn().mockResolvedValue(null),
}))

vi.mock('../maps/TripMap', () => ({
  TripMap: forwardRef(function TripMapMock(_props: unknown, _ref: unknown) {
    return <div data-testid="trip-map-mock" />
  }),
}))

import TripDashboard from './TripDashboard'
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

const days: Day[] = [{ id: 'day-1', tripId: 'trip-1', date: '2026-03-01', label: null }]

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

function renderTripDashboard() {
  return render(
    <MemoryRouter initialEntries={['/trips/trip-1']}>
      <Routes>
        <Route path="/trips/:tripId" element={<TripDashboard />} />
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
})

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  authMocks.getSession.mockReset().mockResolvedValue({ data: { session: fakeSession } })
  authMocks.signInAnonymously.mockReset().mockResolvedValue({ data: { session: fakeSession }, error: null })
  authMocks.onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  fromMock.mockReset()

  tripsMocks.fetchTrip.mockReset()
  tripsMocks.fetchDays.mockReset()
  tripsMocks.fetchItems.mockReset()
})

describe('TripDashboard', () => {
  it('renders the trip header and stat tiles once loaded', async () => {
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue(days)
    tripsMocks.fetchItems.mockResolvedValue([makeItem({ id: 'item-1', dayId: 'day-1', name: 'Osh Bazaar walk' })])

    renderTripDashboard()

    expect(await screen.findByRole('heading', { name: 'Kyrgyzstan Trip' })).toBeInTheDocument()
    expect(screen.getByText('Osh Bazaar walk')).toBeInTheDocument()
  })

  it('links "Full itinerary" through to the map/itinerary screen', async () => {
    tripsMocks.fetchTrip.mockResolvedValue(trip)
    tripsMocks.fetchDays.mockResolvedValue(days)
    tripsMocks.fetchItems.mockResolvedValue([])

    renderTripDashboard()

    const link = await screen.findByRole('link', { name: /full itinerary/i })
    expect(link).toHaveAttribute('href', '/trips/trip-1/itinerary')
  })
})
