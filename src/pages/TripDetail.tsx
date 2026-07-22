import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, CalendarDays } from 'lucide-react'
import { fetchTrip, fetchDays, fetchItems, updateItemPosition, deleteItem } from '../api/trips'
import { DayTabs } from '../itinerary/DayTabs'
import { DayLine } from '../itinerary/DayLine'
import { StaysList } from '../itinerary/StaysList'
import { AddItemModal } from '../itinerary/AddItemModal'
import { TripMap } from '../maps/TripMap'
import { TravelModePicker } from '../maps/TravelModePicker'
import { TransitCard } from '../maps/TransitCard'
import { DayPager } from '../maps/DayPager'
import { TripCalendar } from '../calendar/TripCalendar'
import { lineColorForIndex } from '../utils/lineColors'
import type { TravelMode } from '../utils/distance'
import type { Trip, Day, Item } from '../types/trip'

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDayId, setActiveDayId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>('car')
  const [addModalDate, setAddModalDate] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)

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
      setActiveDayId(dayData[0]?.id ?? null)
      setLoading(false)
    }
    load()
  }, [tripId])

  const activeDayIndex = days.findIndex((d) => d.id === activeDayId)
  const activeColor = activeDayIndex >= 0 ? lineColorForIndex(activeDayIndex) : lineColorForIndex(0)
  const activeDay = days.find((d) => d.id === activeDayId) ?? null

  const activeItems = items
    .filter((item) => item.dayId === activeDayId)
    .sort((a, b) => a.position - b.position)
  const stays = items.filter((item) => item.type === 'stay')

  useEffect(() => {
    if (!activeItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(activeItems[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayId, items])

  const selectedIndex = activeItems.findIndex((item) => item.id === selectedItemId)
  const nextItem = selectedIndex >= 0 ? activeItems[selectedIndex + 1] : undefined
  const selectedItem = selectedIndex >= 0 ? activeItems[selectedIndex] : undefined

  function goToDay(offset: number) {
    if (activeDayIndex < 0) return
    const nextIndex = (activeDayIndex + offset + days.length) % days.length
    setActiveDayId(days[nextIndex].id)
  }

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
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-text-dim hover:text-text">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-line-2" />
            <span className="font-display text-sm font-bold tracking-wide text-text-dim">ATLAS</span>
          </div>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="font-display text-xl font-semibold leading-none tracking-tight text-text">
              {trip.name}
            </h1>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-text-dim">
              {trip.startDate} — {trip.endDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar((v) => !v)}
            className="rounded-md border border-border p-2 text-text-dim hover:text-text"
            aria-label="Month view"
          >
            <CalendarDays size={16} />
          </button>
          <button
            onClick={() => setAddModalDate(activeDay?.date ?? trip.startDate)}
            className="flex items-center gap-1.5 rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
          >
            <Plus size={16} /> Add to trip
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className="flex w-full max-w-md shrink-0 flex-col overflow-y-auto border-r border-border px-5 py-5">
          <DayTabs days={days} activeDayId={activeDayId} onSelect={setActiveDayId} />

          <div className="mt-5">
            <StaysList stays={stays} onDelete={handleDelete} />
          </div>

          {activeDay ? (
            <DayLine
              day={activeDay}
              items={activeItems}
              color={activeColor}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onAddClick={setAddModalDate}
            />
          ) : (
            <p className="text-text-dim">No days yet — add your first flight, stay, or activity.</p>
          )}

          {showCalendar && (
            <div className="absolute left-5 top-16 z-20 w-80 rounded-lg border border-border bg-surface p-3 shadow-xl">
              <TripCalendar
                days={days}
                onSelectDay={(dayId) => {
                  setActiveDayId(dayId)
                  setShowCalendar(false)
                }}
              />
            </div>
          )}
        </aside>

        <main className="relative flex-1">
          <TripMap
            days={days}
            items={items}
            activeDayId={activeDayId}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
          />

          {activeDay && (
            <DayPager
              label={`Day ${activeDayIndex + 1} · ${formatShortDate(activeDay.date)}`}
              onPrev={() => goToDay(-1)}
              onNext={() => goToDay(1)}
            />
          )}

          <TravelModePicker mode={travelMode} onChange={setTravelMode} />

          {selectedItem && nextItem && (
            <TransitCard from={selectedItem} to={nextItem} mode={travelMode} color={activeColor} />
          )}
        </main>
      </div>

      {addModalDate && (
        <AddItemModal
          trip={trip}
          days={days}
          defaultDate={addModalDate}
          itemCount={items.length}
          onClose={() => setAddModalDate(null)}
          onDayCreated={(day) => {
            setDays((current) => {
              const next = [...current, day].sort((a, b) => a.date.localeCompare(b.date))
              return next
            })
            setActiveDayId(day.id)
          }}
          onItemCreated={(item) => setItems((current) => [...current, item])}
        />
      )}
    </div>
  )
}
