import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchTrip, fetchDays, fetchStops, createDay, createStop, updateStopOrder } from '../api/trips'
import { LineMapTimeline } from '../itinerary/LineMapTimeline'
import { TripMap } from '../maps/TripMap'
import { TripCalendar } from '../calendar/TripCalendar'
import type { Trip, Day, Stop, StopCategory } from '../types/trip'

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [newDayDate, setNewDayDate] = useState('')

  useEffect(() => {
    if (!tripId) return
    async function load() {
      const [tripData, dayData] = await Promise.all([fetchTrip(tripId!), fetchDays(tripId!)])
      setTrip(tripData)
      setDays(dayData)
      setStops(await fetchStops(dayData.map((d) => d.id)))
      setLoading(false)
    }
    load()
  }, [tripId])

  const stopsByDay = stops.reduce<Record<string, Stop[]>>((acc, stop) => {
    ;(acc[stop.dayId] ??= []).push(stop)
    return acc
  }, {})
  for (const dayId in stopsByDay) {
    stopsByDay[dayId].sort((a, b) => a.order - b.order)
  }

  async function handleAddDay(event: React.FormEvent) {
    event.preventDefault()
    if (!tripId || !newDayDate) return
    const day = await createDay(tripId, newDayDate)
    setDays((current) => [...current, day].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDayDate('')
  }

  async function handleAddStop(
    dayId: string,
    input: { name: string; category: StopCategory; lat: number; lng: number; startTime: string | null },
  ) {
    const order = (stopsByDay[dayId]?.length ?? 0)
    const stop = await createStop({ dayId, ...input, order })
    setStops((current) => [...current, stop])
  }

  async function handleReorder(dayId: string, orderedStopIds: string[]) {
    setStops((current) =>
      current.map((stop) => {
        if (stop.dayId !== dayId) return stop
        const order = orderedStopIds.indexOf(stop.id)
        return order === -1 ? stop : { ...stop, order }
      }),
    )
    await Promise.all(orderedStopIds.map((id, index) => updateStopOrder(id, index)))
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center font-mono text-sm text-text-dim">Loading…</div>
  }

  if (!trip) {
    return <div className="flex min-h-screen items-center justify-center text-text-dim">Trip not found.</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-5xl font-semibold tracking-tight text-text">{trip.name}</h1>
      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-text-dim">
        {trip.startDate} — {trip.endDate}
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          {days.length === 0 ? (
            <p className="text-text-dim">No days yet — add the first one below.</p>
          ) : (
            <LineMapTimeline
              days={days}
              stopsByDay={stopsByDay}
              onReorder={handleReorder}
              onAddStop={handleAddStop}
            />
          )}

          <form onSubmit={handleAddDay} className="mt-8 flex items-end gap-2 border-t border-border pt-6">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-text-dim">Add day</label>
              <input
                type="date"
                required
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                className="mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-line-2 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
            >
              Add
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-6">
          <div className="h-96 overflow-hidden rounded-md border border-border">
            <TripMap days={days} stopsByDay={stopsByDay} />
          </div>
          {days.length > 0 && <TripCalendar days={days} />}
        </div>
      </div>
    </div>
  )
}
