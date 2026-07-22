import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Plus, MoreVertical, Download, Share2, Pencil } from 'lucide-react'
import {
  fetchTrip,
  fetchDays,
  fetchItems,
  updateItemPosition,
  updateDayLabel,
  deleteItem,
} from '../api/trips'
import { TopNav } from '../components/TopNav'
import { DaySelect } from '../itinerary/DaySelect'
import { DayLine } from '../itinerary/DayLine'
import { BookingDetail } from '../itinerary/BookingDetail'
import { AddItemModal } from '../itinerary/AddItemModal'
import { TripMap } from '../maps/TripMap'
import type { TripMapHandle } from '../maps/TripMap'
import { TravelModePicker } from '../maps/TravelModePicker'
import { TransitCard } from '../maps/TransitCard'
import { DayPager } from '../maps/DayPager'
import { ZoomControl } from '../maps/ZoomControl'
import { TripCalendar } from '../calendar/TripCalendar'
import { lineColorForIndex } from '../utils/lineColors'
import { flagEmoji } from '../utils/flags'
import { actionForItem } from '../utils/itemActions'
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
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [screen, setScreen] = useState<'itinerary' | 'booking'>('itinerary')
  const [bookingItemId, setBookingItemId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(12)
  const [editingDayLabel, setEditingDayLabel] = useState(false)
  const [dayLabelDraft, setDayLabelDraft] = useState('')
  const mapRef = useRef<TripMapHandle>(null)

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

  useEffect(() => {
    if (!activeItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(activeItems[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayId, items])

  const selectedIndex = activeItems.findIndex((item) => item.id === selectedItemId)
  const nextItem = selectedIndex >= 0 ? activeItems[selectedIndex + 1] : undefined
  const selectedItem = selectedIndex >= 0 ? activeItems[selectedIndex] : undefined
  const bookingItem = items.find((item) => item.id === bookingItemId) ?? null

  function handleDayCreated(day: Day) {
    setDays((current) => [...current, day].sort((a, b) => a.date.localeCompare(b.date)))
    setActiveDayId(day.id)
  }

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

  function handleAction(item: Item) {
    const { action } = actionForItem(item)
    if (action === 'booking') {
      setBookingItemId(item.id)
      setScreen('booking')
    } else if (item.googleMapsUrl) {
      window.open(item.googleMapsUrl, '_blank', 'noopener')
    } else {
      setEditingItem(item)
    }
  }

  async function handleCancelBooking() {
    if (!bookingItem) return
    if (!confirm(`Cancel booking for ${bookingItem.name}? This removes it from the trip.`)) return
    await handleDelete(bookingItem.id)
    setBookingItemId(null)
    setScreen('itinerary')
  }

  function startDayLabelEdit() {
    setDayLabelDraft(activeDay?.label ?? '')
    setEditingDayLabel(true)
  }

  async function saveDayLabel() {
    setEditingDayLabel(false)
    if (!activeDay) return
    const label = dayLabelDraft.trim() || null
    if (label === activeDay.label) return
    setDays((current) => current.map((d) => (d.id === activeDay.id ? { ...d, label } : d)))
    await updateDayLabel(activeDay.id, label)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-text-dim">Loading…</div>
  }

  if (!trip) {
    return <div className="flex min-h-screen items-center justify-center text-text-dim">Trip not found.</div>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-text">
      <TopNav active="Itinerary" />

      <div className="flex min-h-0 flex-1">
        <aside className="relative flex w-[400px] shrink-0 flex-col border-r border-border overflow-hidden">
          {screen === 'itinerary' ? (
            <>
              <div className="px-[22px] pt-[18px]">
                <div className="mb-4 flex items-center justify-between">
                  <Link to="/" className="flex items-center gap-2 text-xs font-semibold text-text-dim hover:text-text">
                    <ChevronLeft size={14} /> Itinerary Detail
                  </Link>
                  <div className="flex items-center gap-3.5 text-text-dim">
                    <button
                      onClick={() => setAddModalDate(activeDay?.date ?? trip.startDate)}
                      aria-label="Add to trip"
                      className="hover:text-text"
                    >
                      <Plus size={15} />
                    </button>
                    <span title="Export — coming soon" className="cursor-default opacity-60">
                      <Download size={14} />
                    </span>
                    <span title="Share — coming soon" className="cursor-default opacity-60">
                      <Share2 size={14} />
                    </span>
                    <button
                      onClick={() => setShowCalendar((v) => !v)}
                      aria-label="Month view"
                      className="hover:text-text"
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                </div>

                <h1 className="mb-1.5 text-[23px] font-extrabold leading-tight tracking-tight text-text">
                  {trip.name} &mdash; {days.length} Day Trip
                </h1>
                {trip.description && (
                  <p className="mb-3.5 text-xs leading-relaxed text-text-dim">{trip.description}</p>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1 text-[11px] font-bold text-text">
                    {flagEmoji(trip.countryCode) && <span>{flagEmoji(trip.countryCode)}</span>}
                    {formatShortDate(trip.startDate)} &ndash; {formatShortDate(trip.endDate)}
                  </div>
                  <div className="text-[11.5px] text-text-dim">
                    {days.length} Day{days.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-[11.5px] text-text-dim">&middot; {items.length} Stops</div>
                  <div className="flex-1" />
                  {activeDayId && <DaySelect days={days} activeDayId={activeDayId} onSelect={setActiveDayId} />}
                </div>

                <div className="mb-0.5 flex items-center justify-between">
                  <p className="text-[10.5px] font-semibold text-text-dimmer">
                    Day {activeDayIndex + 1} &middot; {activeDay ? formatShortDate(activeDay.date) : ''}
                  </p>
                </div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  {editingDayLabel ? (
                    <input
                      autoFocus
                      value={dayLabelDraft}
                      onChange={(e) => setDayLabelDraft(e.target.value)}
                      onBlur={saveDayLabel}
                      onKeyDown={(e) => e.key === 'Enter' && saveDayLabel()}
                      placeholder={`Day ${activeDayIndex + 1}`}
                      className="w-full rounded-md border border-border bg-ink px-2 py-1 text-base font-extrabold text-text focus:border-paper focus:outline-none"
                    />
                  ) : (
                    <>
                      <h2 className="text-base font-extrabold text-text">
                        {activeDay?.label || `Day ${activeDayIndex + 1}`}
                      </h2>
                      <button onClick={startDayLabelEdit} className="text-text-dimmer hover:text-text-dim">
                        <Pencil size={12} />
                      </button>
                    </>
                  )}
                </div>

                {showCalendar && (
                  <div className="absolute left-[22px] top-16 z-20 w-80 rounded-lg border border-border bg-surface p-3 shadow-2xl">
                    <TripCalendar
                      days={days}
                      onSelectDay={(dayId) => {
                        setActiveDayId(dayId)
                        setShowCalendar(false)
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-6 pt-0.5">
                {activeDay ? (
                  <DayLine
                    day={activeDay}
                    items={activeItems}
                    color={activeColor}
                    selectedItemId={selectedItemId}
                    onSelectItem={setSelectedItemId}
                    onAction={handleAction}
                    onEdit={setEditingItem}
                    onReorder={handleReorder}
                    onDelete={handleDelete}
                    onAddClick={setAddModalDate}
                  />
                ) : (
                  <p className="text-text-dim">No days yet — add your first flight, stay, or activity.</p>
                )}
              </div>
            </>
          ) : bookingItem ? (
            <BookingDetail
              item={bookingItem}
              onBack={() => setScreen('itinerary')}
              onModify={() => setEditingItem(bookingItem)}
              onCancel={handleCancelBooking}
            />
          ) : null}
        </aside>

        <main className="relative flex-1 bg-map-bg">
          <TripMap
            ref={mapRef}
            days={days}
            items={items}
            activeDayId={activeDayId}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onZoomChange={setZoom}
          />

          {activeDay && (
            <DayPager
              label={`Day ${activeDayIndex + 1} · ${formatShortDate(activeDay.date)}`}
              onPrev={() => goToDay(-1)}
              onNext={() => goToDay(1)}
            />
          )}

          <TravelModePicker mode={travelMode} onChange={setTravelMode} color={activeColor} />

          {selectedItem && nextItem && (
            <TransitCard from={selectedItem} to={nextItem} mode={travelMode} color={activeColor} />
          )}

          <ZoomControl
            zoom={zoom}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
          />
        </main>
      </div>

      {addModalDate && (
        <AddItemModal
          trip={trip}
          days={days}
          defaultDate={addModalDate}
          itemCount={items.length}
          onClose={() => setAddModalDate(null)}
          onDayCreated={handleDayCreated}
          onItemCreated={(item) => setItems((current) => [...current, item])}
        />
      )}

      {editingItem && (
        <AddItemModal
          trip={trip}
          days={days}
          editItem={editingItem}
          itemCount={items.length}
          onClose={() => setEditingItem(null)}
          onDayCreated={handleDayCreated}
          onItemCreated={() => {}}
          onItemUpdated={(updated) => {
            setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)))
          }}
        />
      )}
    </div>
  )
}
