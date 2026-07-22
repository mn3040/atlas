import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  MoreVertical,
  Download,
  Share2,
  Pencil,
  Trash2,
  CalendarDays,
  BedDouble,
  Play,
  Pause,
} from 'lucide-react'
import {
  fetchTrip,
  fetchDays,
  fetchItems,
  updateItemPosition,
  updateDayLabel,
  updateTrip,
  deleteTrip,
  deleteItem,
} from '../api/trips'
import { TopNav } from '../components/TopNav'
import { CountryFlag } from '../components/CountryFlag'
import { DaySelect } from '../itinerary/DaySelect'
import { DayLine } from '../itinerary/DayLine'
import { BookingDetail } from '../itinerary/BookingDetail'
import { FlightDetail } from '../itinerary/FlightDetail'
import { AddItemModal } from '../itinerary/AddItemModal'
import { EditTripModal } from '../itinerary/EditTripModal'
import { TripMap } from '../maps/TripMap'
import type { TripMapHandle } from '../maps/TripMap'
import { TravelModePicker } from '../maps/TravelModePicker'
import { TransitCard } from '../maps/TransitCard'
import { DayPager } from '../maps/DayPager'
import { ZoomControl } from '../maps/ZoomControl'
import { TripCalendar } from '../calendar/TripCalendar'
import { lineColorForIndex } from '../utils/lineColors'
import { actionForItem } from '../utils/itemActions'
import { downloadItinerary } from '../utils/exportItinerary'
import type { TravelMode } from '../utils/distance'
import type { Trip, Day, Item } from '../types/trip'

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
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
  const [showMenu, setShowMenu] = useState(false)
  const [showEditTrip, setShowEditTrip] = useState(false)
  const [screen, setScreen] = useState<'itinerary' | 'booking' | 'flight'>('itinerary')
  const [bookingItemId, setBookingItemId] = useState<string | null>(null)
  const [flightItemId, setFlightItemId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(12)
  const [editingDayLabel, setEditingDayLabel] = useState(false)
  const [dayLabelDraft, setDayLabelDraft] = useState('')
  const [isTouring, setIsTouring] = useState(false)
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

  // Stays get their own "Where you're staying" section, separate from the
  // day-by-day activity/flight timeline, since a stay spans multiple days
  // rather than belonging to just one.
  const stays = items
    .filter((item) => item.type === 'stay')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const activeItems = items
    .filter((item) => item.dayId === activeDayId && item.type !== 'stay')
    .sort((a, b) => a.position - b.position)

  useEffect(() => {
    if (!activeItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(activeItems[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayId, items])

  // Auto-tour: step through the day's stops on a timer, reusing the same
  // selection -> flyTo/highlight path a manual click already triggers. The
  // route line between stops already reflects whichever travel mode is
  // selected, so switching mode mid-tour changes what the tour shows.
  useEffect(() => {
    if (!isTouring || activeItems.length < 2) return
    const timer = window.setInterval(() => {
      setSelectedItemId((current) => {
        const index = activeItems.findIndex((item) => item.id === current)
        const nextIndex = (index + 1) % activeItems.length
        return activeItems[nextIndex].id
      })
    }, 2800)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouring, activeDayId, activeItems.length])

  useEffect(() => {
    setIsTouring(false)
  }, [activeDayId])

  const selectedIndex = activeItems.findIndex((item) => item.id === selectedItemId)
  const nextItem = selectedIndex >= 0 ? activeItems[selectedIndex + 1] : undefined
  const selectedItem = selectedIndex >= 0 ? activeItems[selectedIndex] : undefined
  const bookingItem = items.find((item) => item.id === bookingItemId) ?? null
  const flightItem = items.find((item) => item.id === flightItemId) ?? null

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
    } else if (action === 'flight') {
      setFlightItemId(item.id)
      setScreen('flight')
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

  async function handleCancelFlight() {
    if (!flightItem) return
    if (!confirm(`Cancel ${flightItem.flightNumber || 'this flight'}? This removes it from the trip.`)) return
    await handleDelete(flightItem.id)
    setFlightItemId(null)
    setScreen('itinerary')
  }

  async function handleUpdateTrip(input: {
    name: string
    description: string
    countryCode: string
    startDate: string
    endDate: string
  }) {
    if (!trip) return
    const updated = await updateTrip(trip.id, input)
    setTrip(updated)
    setShowEditTrip(false)
  }

  async function handleDeleteTrip() {
    if (!trip) return
    if (!confirm(`Delete "${trip.name}"? This removes the whole trip and everything in it.`)) return
    await deleteTrip(trip.id)
    navigate('/')
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
                    <button
                      onClick={() => downloadItinerary(trip, days, items)}
                      aria-label="Export itinerary"
                      title="Export itinerary"
                      className="hover:text-text"
                    >
                      <Download size={14} />
                    </button>
                    <span title="Share — coming soon" className="cursor-default opacity-60">
                      <Share2 size={14} />
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu((v) => !v)}
                        aria-label="Trip options"
                        className="hover:text-text"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {showMenu && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                          <div className="absolute right-0 top-6 z-30 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-2xl">
                            <button
                              onClick={() => {
                                setShowCalendar((v) => !v)
                                setShowMenu(false)
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text hover:bg-surface-2"
                            >
                              <CalendarDays size={13} /> Month view
                            </button>
                            <button
                              onClick={() => {
                                setShowEditTrip(true)
                                setShowMenu(false)
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text hover:bg-surface-2"
                            >
                              <Pencil size={13} /> Edit trip details
                            </button>
                            <button
                              onClick={() => {
                                setShowMenu(false)
                                handleDeleteTrip()
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-line-4 hover:bg-surface-2"
                            >
                              <Trash2 size={13} /> Delete trip
                            </button>
                          </div>
                        </>
                      )}
                    </div>
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
                    <CountryFlag countryCode={trip.countryCode} className="h-3 w-auto rounded-[1px]" />
                    {formatShortDate(trip.startDate)} &ndash; {formatShortDate(trip.endDate)}
                  </div>
                  <div className="text-[11.5px] text-text-dim">
                    {days.length} Day{days.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-[11.5px] text-text-dim">&middot; {items.length} Stops</div>
                  <div className="flex-1" />
                  {activeDayId && <DaySelect days={days} activeDayId={activeDayId} onSelect={setActiveDayId} />}
                </div>

                {stays.length > 0 && (
                  <div className="mb-4 space-y-2 border-t border-border pt-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-dimmer">
                      <BedDouble size={12} /> Where you&rsquo;re staying
                    </p>
                    {stays.map((stay) => (
                      <button
                        key={stay.id}
                        onClick={() => {
                          setBookingItemId(stay.id)
                          setScreen('booking')
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-2.5 text-left transition-colors hover:border-border-strong"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-surface-3 text-text-dim">
                          {stay.photoUrl ? (
                            <img src={stay.photoUrl} alt={stay.name} className="h-full w-full object-cover" />
                          ) : (
                            <BedDouble size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-bold text-text">{stay.name}</p>
                          <p className="text-[10.5px] text-text-dim">
                            {formatShortDate(stay.startDate)} &ndash; {formatShortDate(stay.endDate ?? stay.startDate)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

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
          ) : screen === 'booking' && bookingItem ? (
            <BookingDetail
              item={bookingItem}
              onBack={() => setScreen('itinerary')}
              onModify={() => setEditingItem(bookingItem)}
              onCancel={handleCancelBooking}
            />
          ) : screen === 'flight' && flightItem ? (
            <FlightDetail
              item={flightItem}
              onBack={() => setScreen('itinerary')}
              onModify={() => setEditingItem(flightItem)}
              onCancel={handleCancelFlight}
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
            travelMode={travelMode}
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

          {activeItems.length > 1 && (
            <button
              onClick={() => setIsTouring((v) => !v)}
              aria-label={isTouring ? 'Pause tour' : 'Play tour'}
              className="absolute left-4 top-4 z-10 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border-strong transition-colors"
              style={{
                background: isTouring ? activeColor : 'var(--color-surface)',
                color: isTouring ? '#fff' : 'var(--color-text-dim)',
              }}
            >
              {isTouring ? <Pause size={15} /> : <Play size={15} />}
            </button>
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

      {showEditTrip && <EditTripModal trip={trip} onClose={() => setShowEditTrip(false)} onSave={handleUpdateTrip} />}
    </div>
  )
}
