import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { fetchTrip, fetchDays, fetchItems, updateItemPosition, deleteItem } from '../api/trips'
import { LineMapTimeline } from '../itinerary/LineMapTimeline'
import { StaysList } from '../itinerary/StaysList'
import { AddItemModal } from '../itinerary/AddItemModal'
import { TripMap } from '../maps/TripMap'
import { TripCalendar } from '../calendar/TripCalendar'
import type { Trip, Day, Item } from '../types/trip'

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalDate, setAddModalDate] = useState<string | null>(null)

  useEffect(() => {
    if (!tripId) return
    async function load() {
      const [tripData, dayData, itemData] = await Promise.all([
        fetchTrip(tripId!),
        fetchDays(tripId!),
        fetchItems(tripId!),
      ])
      setTrip(tripData)
      setDays(dayData)
      setItems(itemData)
      setLoading(false)
    }
    load()
  }, [tripId])

  const itemsByDay = items.reduce<Record<string, Item[]>>((acc, item) => {
    if (item.type === 'stay' || !item.dayId) return acc
    ;(acc[item.dayId] ??= []).push(item)
    return acc
  }, {})
  for (const dayId in itemsByDay) {
    itemsByDay[dayId].sort((a, b) => a.position - b.position)
  }
  const stays = items.filter((item) => item.type === 'stay')

  async function handleReorder(dayId: string, orderedItemIds: string[]) {
    setItems((current) =>
      current.map((item) => {
        if (item.dayId !== dayId) return item
        const position = orderedItemIds.indexOf(item.id)
        return position === -1 ? item : { ...item, position }
      }),
    )
    await Promise.all(orderedItemIds.map((id, index) => updateItemPosition(id, index)))
  }

  async function handleDelete(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
    await deleteItem(id)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center font-mono text-sm text-text-dim">Loading…</div>
  }

  if (!trip) {
    return <div className="flex min-h-screen items-center justify-center text-text-dim">Trip not found.</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-text">{trip.name}</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-wide text-text-dim">
            {trip.startDate} — {trip.endDate}
          </p>
        </div>
        <button
          onClick={() => setAddModalDate(days[0]?.date ?? trip.startDate)}
          className="flex items-center gap-1.5 rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
        >
          <Plus size={16} /> Add to trip
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <StaysList stays={stays} onDelete={handleDelete} />

          {days.length === 0 ? (
            <p className="text-text-dim">No days yet — add your first flight, stay, or activity.</p>
          ) : (
            <LineMapTimeline
              days={days}
              itemsByDay={itemsByDay}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onAddClick={setAddModalDate}
            />
          )}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <div className="h-96 overflow-hidden rounded-md border border-border">
            <TripMap days={days} items={items} />
          </div>
          {days.length > 0 && <TripCalendar days={days} />}
        </div>
      </div>

      {addModalDate && (
        <AddItemModal
          trip={trip}
          days={days}
          defaultDate={addModalDate}
          itemCount={items.length}
          onClose={() => setAddModalDate(null)}
          onDayCreated={(day) => setDays((current) => [...current, day].sort((a, b) => a.date.localeCompare(b.date)))}
          onItemCreated={(item) => setItems((current) => [...current, item])}
        />
      )}
    </div>
  )
}
