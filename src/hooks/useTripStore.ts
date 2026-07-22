import { create } from 'zustand'
import type { Trip, Day, Stop } from '../types/trip'

interface TripStore {
  trips: Trip[]
  days: Day[]
  stops: Stop[]
  setTrips: (trips: Trip[]) => void
  setDays: (days: Day[]) => void
  setStops: (stops: Stop[]) => void
  reorderStops: (dayId: string, orderedStopIds: string[]) => void
}

export const useTripStore = create<TripStore>((set) => ({
  trips: [],
  days: [],
  stops: [],
  setTrips: (trips) => set({ trips }),
  setDays: (days) => set({ days }),
  setStops: (stops) => set({ stops }),
  reorderStops: (dayId, orderedStopIds) =>
    set((state) => ({
      stops: state.stops.map((stop) => {
        if (stop.dayId !== dayId) return stop
        const order = orderedStopIds.indexOf(stop.id)
        return order === -1 ? stop : { ...stop, order }
      }),
    })),
}))
