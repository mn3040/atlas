import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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

const { fetchTripsMock, createTripMock, deleteTripMock, fetchItemsForTripsMock } = vi.hoisted(() => ({
  fetchTripsMock: vi.fn(),
  createTripMock: vi.fn(),
  deleteTripMock: vi.fn(),
  fetchItemsForTripsMock: vi.fn(),
}))

vi.mock('../api/trips', () => ({
  fetchTrips: fetchTripsMock,
  createTrip: createTripMock,
  deleteTrip: deleteTripMock,
  fetchItemsForTrips: fetchItemsForTripsMock,
}))

vi.mock('../api/alerts', () => ({
  fetchTripAlertSummary: vi.fn().mockResolvedValue({ expiringDocuments: 0, openVotes: 0 }),
}))

import Dashboard from './Dashboard'
import type { Trip } from '../types/trip'

const fakeSession = { user: { id: 'user-1' } }

const personalTrip: Trip = {
  id: 'trip-1',
  ownerId: 'user-1',
  name: 'Kyrgyzstan Explorer',
  description: null,
  countryCode: 'KG',
  visibility: 'personal',
  memberLimit: null,
  archivedAt: null,
  startDate: '2026-03-01',
  endDate: '2026-03-10',
  createdAt: '2026-01-01T00:00:00Z',
}

const groupTrip: Trip = {
  id: 'trip-2',
  ownerId: 'user-1',
  name: 'Tokyo Food Week',
  description: null,
  countryCode: 'JP',
  visibility: 'group',
  memberLimit: 4,
  archivedAt: null,
  startDate: '2026-09-08',
  endDate: '2026-09-11',
  createdAt: '2026-01-01T00:00:00Z',
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  authMocks.getSession.mockReset().mockResolvedValue({ data: { session: fakeSession } })
  authMocks.signInAnonymously.mockReset().mockResolvedValue({ data: { session: fakeSession }, error: null })
  authMocks.onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  fromMock.mockReset()

  fetchTripsMock.mockReset()
  createTripMock.mockReset()
  deleteTripMock.mockReset()
  fetchItemsForTripsMock.mockReset().mockResolvedValue({})

  window.localStorage.clear()
})

describe('Dashboard', () => {
  it('renders fetched trips grouped into personal and group sections', async () => {
    fetchTripsMock.mockResolvedValue([personalTrip, groupTrip])

    renderDashboard()

    expect(await screen.findByText('Kyrgyzstan Explorer')).toBeInTheDocument()
    expect(screen.getByText('Tokyo Food Week')).toBeInTheDocument()
    expect(screen.getByText('2026-03-01 – 2026-03-10')).toBeInTheDocument()
    expect(screen.getByText('Personal trips')).toBeInTheDocument()
    expect(screen.getByText('Group trips')).toBeInTheDocument()
  })

  it('shows an empty state when there are no trips', async () => {
    fetchTripsMock.mockResolvedValue([])

    renderDashboard()

    expect(await screen.findByText(/No trips yet/)).toBeInTheDocument()
  })

  it('creates a trip with the form payload and the signed-in owner id', async () => {
    fetchTripsMock.mockResolvedValue([])
    createTripMock.mockResolvedValue({ ...personalTrip, id: 'trip-new', name: 'New Adventure' })

    const { container } = renderDashboard()
    await screen.findByText(/No trips yet/)

    await userEvent.click(screen.getByRole('button', { name: /new trip/i }))
    await userEvent.type(screen.getByPlaceholderText('Kazakhstan Explorer'), 'New Adventure')
    await userEvent.type(screen.getByPlaceholderText('KZ'), 'KZ')

    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-05-05' } })

    await userEvent.click(screen.getByRole('button', { name: /create trip/i }))

    await waitFor(() => expect(createTripMock).toHaveBeenCalled())
    expect(createTripMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Adventure',
        countryCode: 'KZ',
        visibility: 'personal',
        memberLimit: null,
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        ownerId: 'user-1',
      }),
    )
    expect(await screen.findByText('New Adventure')).toBeInTheDocument()
  })

  it('deletes a trip immediately when confirm-before-delete is disabled', async () => {
    window.localStorage.setItem('atlas:settings', JSON.stringify({ confirmBeforeDelete: false }))
    fetchTripsMock.mockResolvedValue([personalTrip])
    deleteTripMock.mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm')

    renderDashboard()
    await screen.findByText('Kyrgyzstan Explorer')

    await userEvent.click(screen.getByRole('button', { name: /delete kyrgyzstan explorer/i }))

    await waitFor(() => expect(deleteTripMock).toHaveBeenCalledWith('trip-1'))
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('asks for confirmation before deleting a trip and aborts when the user cancels', async () => {
    fetchTripsMock.mockResolvedValue([personalTrip])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderDashboard()
    await screen.findByText('Kyrgyzstan Explorer')

    await userEvent.click(screen.getByRole('button', { name: /delete kyrgyzstan explorer/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteTripMock).not.toHaveBeenCalled()
    expect(screen.getByText('Kyrgyzstan Explorer')).toBeInTheDocument()
  })
})
