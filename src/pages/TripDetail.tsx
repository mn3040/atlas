import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  MoreVertical,
  Download,
  FileUp,
  Pencil,
  Trash2,
  CalendarDays,
  BedDouble,
  Play,
  Pause,
  ChevronsDown,
  ChevronsUp,
  Route,
  Users,
  Trophy,
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
import { fetchItemVoteSummary, setItemMustSeeVote } from '../api/votes'
import { TopNav } from '../components/TopNav'
import { useSession } from '../hooks/useSession'
import { useProfile } from '../hooks/useProfile'
import { CountryFlags } from '../components/CountryFlag'
import { DaySelect } from '../itinerary/DaySelect'
import { DayLine } from '../itinerary/DayLine'
import { DayOptionsPanel } from '../itinerary/DayOptionsPanel'
import { BookingDetail } from '../itinerary/BookingDetail'
import { FlightDetail } from '../itinerary/FlightDetail'
import { AddItemModal } from '../itinerary/AddItemModal'
import { ImportItineraryModal } from '../itinerary/ImportItineraryModal'
import { EditTripModal } from '../itinerary/EditTripModal'
import { GroupTripModal } from '../itinerary/GroupTripModal'
import { GroupPicksModal } from '../itinerary/GroupPicksModal'
import { TripMap } from '../maps/TripMap'
import type { TripMapHandle } from '../maps/TripMap'
import { TravelModePicker } from '../maps/TravelModePicker'
import { TransitCard } from '../maps/TransitCard'
import { DayPager } from '../maps/DayPager'
import { ZoomControl } from '../maps/ZoomControl'
import { TripCalendar } from '../calendar/TripCalendar'
import { lineColorForIndex } from '../utils/lineColors'
import { actionForItem, bookingUrlForItem, mapsUrlForItem } from '../utils/itemActions'
import { downloadItinerary } from '../utils/exportItinerary'
import { APP_SETTINGS_EVENT, getAppSettings, shouldConfirmBeforeDelete } from '../utils/settings'
import { filterItemsForView, loadMustSeeIds, saveMustSeeIds } from '../utils/mustSee'
import { countryCodesForTrip } from '../utils/flags'
import type { TravelMode } from '../utils/distance'
import type { AppSettings } from '../utils/settings'
import type { DayOptionView } from '../utils/mustSee'
import type { Trip, Day, Item, TripVisibility, ItemVoteSummary, Profile } from '../types/trip'

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function updateOptimisticVote(
  current: Record<string, ItemVoteSummary>,
  itemId: string,
  active: boolean,
  userId: string,
  profile: Profile | null,
): Record<string, ItemVoteSummary> {
  const summary = current[itemId] ?? { itemId, voters: [], viewerVoted: false }
  const voters = summary.voters.filter((voter) => voter.userId !== userId)
  if (active) {
    voters.push({
      userId,
      displayName: profile?.displayName ?? 'You',
      avatarColor: profile?.avatarColor ?? '#22dd85',
    })
  }
  return {
    ...current,
    [itemId]: {
      itemId,
      voters,
      viewerVoted: active,
    },
  }
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { profile } = useProfile(session)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDayId, setActiveDayId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>(() => getAppSettings().defaultTravelMode)
  const [addModalDate, setAddModalDate] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showEditTrip, setShowEditTrip] = useState(false)
  const [showGroupTrip, setShowGroupTrip] = useState(false)
  const [showGroupPicks, setShowGroupPicks] = useState(false)
  const [dayOptionView, setDayOptionView] = useState<DayOptionView>('all')
  const [mustSeeIds, setMustSeeIds] = useState<Set<string>>(() => new Set())
  const [voteSummary, setVoteSummary] = useState<Record<string, ItemVoteSummary>>({})
  const [voteError, setVoteError] = useState<string | null>(null)
  const [screen, setScreen] = useState<'itinerary' | 'booking' | 'flight'>('itinerary')
  const [bookingItemId, setBookingItemId] = useState<string | null>(null)
  const [flightItemId, setFlightItemId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(12)
  const [editingDayLabel, setEditingDayLabel] = useState(false)
  const [dayLabelDraft, setDayLabelDraft] = useState('')
  const [isTouring, setIsTouring] = useState(false)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)
  const [showRouteTools, setShowRouteTools] = useState(false)
  const mapRef = useRef<TripMapHandle>(null)
  const sheetRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null)

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

  useEffect(() => {
    if (!tripId) return
    setMustSeeIds(loadMustSeeIds(tripId))
  }, [tripId])

  useEffect(() => {
    if (!tripId || !session?.user.id || trip?.visibility !== 'group') {
      setVoteSummary({})
      return
    }

    let cancelled = false
    setVoteError(null)
    fetchItemVoteSummary(tripId, session.user.id)
      .then((summary) => {
        if (!cancelled) setVoteSummary(summary)
      })
      .catch((err) => {
        if (!cancelled) setVoteError(err instanceof Error ? err.message : 'Could not load group votes.')
      })

    return () => {
      cancelled = true
    }
  }, [tripId, session?.user.id, trip?.visibility])

  useEffect(() => {
    function handleSettings(event: Event) {
      const settings = (event as CustomEvent<AppSettings>).detail
      setTravelMode(settings.defaultTravelMode)
    }
    window.addEventListener(APP_SETTINGS_EVENT, handleSettings)
    return () => window.removeEventListener(APP_SETTINGS_EVENT, handleSettings)
  }, [])

  const activeDayIndex = days.findIndex((d) => d.id === activeDayId)
  const activeColor = activeDayIndex >= 0 ? lineColorForIndex(activeDayIndex) : lineColorForIndex(0)
  const activeDay = days.find((d) => d.id === activeDayId) ?? null
  const groupVoting = trip?.visibility === 'group'

  // Stays get their own "Where you're staying" section, separate from the
  // day-by-day activity/flight timeline, since a stay spans multiple days
  // rather than belonging to just one.
  const stays = items
    .filter((item) => item.type === 'stay')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const activeItems = items
    .filter((item) => item.dayId === activeDayId && item.type !== 'stay')
    .sort((a, b) => a.position - b.position)
  const currentMustSeeIds = groupVoting
    ? new Set(Object.values(voteSummary).filter((summary) => summary.viewerVoted).map((summary) => summary.itemId))
    : mustSeeIds
  const displayedActiveItems = filterItemsForView(activeItems, currentMustSeeIds, dayOptionView)
  const displayedActiveIds = new Set(displayedActiveItems.map((item) => item.id))
  const mapItems =
    dayOptionView === 'all'
      ? items
      : items.filter((item) => item.dayId !== activeDayId || item.type === 'stay' || displayedActiveIds.has(item.id))

  useEffect(() => {
    if (!displayedActiveItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(displayedActiveItems[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayId, items, dayOptionView, mustSeeIds, voteSummary])

  // Auto-tour: step through the day's stops on a timer, reusing the same
  // selection -> flyTo/highlight path a manual click already triggers. The
  // route line between stops already reflects whichever travel mode is
  // selected, so switching mode mid-tour changes what the tour shows.
  useEffect(() => {
    if (!isTouring || displayedActiveItems.length < 2) return
    const timer = window.setInterval(() => {
      setSelectedItemId((current) => {
        const index = displayedActiveItems.findIndex((item) => item.id === current)
        const nextIndex = (index + 1) % displayedActiveItems.length
        return displayedActiveItems[nextIndex].id
      })
    }, 2800)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouring, activeDayId, displayedActiveItems.length])

  useEffect(() => {
    setIsTouring(false)
  }, [activeDayId])

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.resize(true), 90)
    return () => window.clearTimeout(timer)
  }, [mobileSheetExpanded])

  const selectedIndex = displayedActiveItems.findIndex((item) => item.id === selectedItemId)
  const nextItem = selectedIndex >= 0 ? displayedActiveItems[selectedIndex + 1] : undefined
  const selectedItem = selectedIndex >= 0 ? displayedActiveItems[selectedIndex] : undefined
  const bookingItem = items.find((item) => item.id === bookingItemId) ?? null
  const flightItem = items.find((item) => item.id === flightItemId) ?? null
  const tripCountryCodes = trip ? countryCodesForTrip(trip, items) : []

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
    const item = items.find((candidate) => candidate.id === id)
    if (shouldConfirmBeforeDelete() && item && !confirm(`Remove "${item.name}" from this itinerary?`)) return
    setItems((current) => current.filter((item) => item.id !== id))
    await deleteItem(id)
  }

  async function handleToggleMustSee(id: string) {
    if (groupVoting) {
      if (!trip || !session?.user.id) return
      const nextActive = !voteSummary[id]?.viewerVoted
      setVoteError(null)
      setVoteSummary((current) => updateOptimisticVote(current, id, nextActive, session.user.id, profile))
      try {
        await setItemMustSeeVote({
          tripId: trip.id,
          itemId: id,
          userId: session.user.id,
          active: nextActive,
        })
        setVoteSummary(await fetchItemVoteSummary(trip.id, session.user.id))
      } catch (err) {
        setVoteError(err instanceof Error ? err.message : 'Could not save this vote.')
        setVoteSummary(await fetchItemVoteSummary(trip.id, session.user.id).catch(() => ({})))
      }
      return
    }

    if (!tripId) return
    setMustSeeIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveMustSeeIds(tripId, next)
      return next
    })
  }

  function handleAction(item: Item) {
    const { action } = actionForItem(item)
    if (action === 'booking') {
      setBookingItemId(item.id)
      setScreen('booking')
    } else if (action === 'flight') {
      setFlightItemId(item.id)
      setScreen('flight')
    } else if (action === 'maps') {
      window.open(bookingUrlForItem(item), '_blank', 'noopener')
    } else {
      setEditingItem(item)
    }
  }

  async function handleCancelBooking() {
    if (!bookingItem) return
    if (shouldConfirmBeforeDelete() && !confirm(`Cancel booking for ${bookingItem.name}? This removes it from the trip.`)) return
    await handleDelete(bookingItem.id)
    setBookingItemId(null)
    setScreen('itinerary')
  }

  async function handleCancelFlight() {
    if (!flightItem) return
    if (shouldConfirmBeforeDelete() && !confirm(`Cancel ${flightItem.flightNumber || 'this flight'}? This removes it from the trip.`)) return
    await handleDelete(flightItem.id)
    setFlightItemId(null)
    setScreen('itinerary')
  }

  async function handleUpdateTrip(input: {
    name: string
    description: string
    countryCode: string
    visibility: TripVisibility
    memberLimit: number | null
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
    if (shouldConfirmBeforeDelete() && !confirm(`Delete "${trip.name}"? This removes the whole trip and everything in it.`)) return
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

  function handleSheetTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartRef.current = {
      y: event.touches[0]?.clientY ?? 0,
      scrollTop: sheetRef.current?.scrollTop ?? 0,
    }
  }

  function handleSheetTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return

    const endY = event.changedTouches[0]?.clientY ?? start.y
    const deltaY = endY - start.y
    if (Math.abs(deltaY) < 44) return

    if (deltaY < 0) {
      setMobileSheetExpanded(true)
    } else if (start.scrollTop <= 2) {
      setMobileSheetExpanded(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-text-dim">Loading…</div>
  }

  if (!trip) {
    return <div className="flex min-h-screen items-center justify-center text-text-dim">Trip not found.</div>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-text [height:100dvh]">
      <TopNav />

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          ref={sheetRef}
          onTouchStart={handleSheetTouchStart}
          onTouchEnd={handleSheetTouchEnd}
          className={`itinerary-scroll absolute inset-x-0 bottom-0 z-20 flex min-h-0 w-full shrink-0 touch-pan-y flex-col overflow-y-auto overscroll-contain rounded-t-lg border border-border-strong bg-surface shadow-2xl transition-[height] duration-300 md:relative md:inset-auto md:z-auto md:h-auto md:w-[400px] md:flex-none md:overflow-hidden md:rounded-none md:border-y-0 md:border-l-0 md:border-r ${
            mobileSheetExpanded ? 'h-[86dvh]' : 'h-[48dvh]'
          }`}
        >
          {screen === 'itinerary' ? (
            <>
              <div className="flex h-8 shrink-0 items-center justify-center border-b border-border bg-surface md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileSheetExpanded((value) => !value)}
                  className="flex h-full w-full items-center justify-center gap-2 text-text-dim"
                  aria-label={mobileSheetExpanded ? 'Collapse itinerary sheet' : 'Expand itinerary sheet'}
                >
                  <span className="flex items-center gap-1.5 rounded-full border border-border bg-ink/50 px-3 py-1">
                    <span className="h-1 w-8 rounded-full bg-text-dimmer" />
                    {mobileSheetExpanded ? <ChevronsDown size={13} /> : <ChevronsUp size={13} />}
                  </span>
                </button>
              </div>
              <div className="px-4 pb-[calc(2.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-[22px] sm:pt-[18px] md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-6">
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
                      onClick={() => downloadItinerary(trip, days, items, currentMustSeeIds)}
                      aria-label="Export itinerary"
                      title="Export itinerary"
                      className="hover:text-text"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => setShowImportModal(true)}
                      aria-label="Import itinerary document"
                      title="Import itinerary document"
                      className="hover:text-text"
                    >
                      <FileUp size={14} />
                    </button>
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
                            {trip.visibility === 'group' && (
                              <>
                                <button
                                  onClick={() => {
                                    setShowGroupPicks(true)
                                    setShowMenu(false)
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text hover:bg-surface-2"
                                >
                                  <Trophy size={13} /> Group picks
                                </button>
                                <button
                                  onClick={() => {
                                    setShowGroupTrip(true)
                                    setShowMenu(false)
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text hover:bg-surface-2"
                                >
                                  <Users size={13} /> Group invite
                                </button>
                              </>
                            )}
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

                <h1 className="mb-1.5 text-[20px] font-extrabold leading-tight tracking-tight text-text sm:text-[23px]">
                  {trip.name} &mdash; {days.length} Day Trip
                </h1>
                {trip.description && (
                  <p className="mb-3.5 text-xs leading-relaxed text-text-dim">{trip.description}</p>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1 text-[11px] font-bold text-text">
                    <CountryFlags countryCodes={tripCountryCodes} className="h-3 w-auto rounded-[1px]" />
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
                  <div className="absolute left-4 right-4 top-16 z-20 rounded-lg border border-border bg-surface p-3 shadow-2xl sm:left-[22px] sm:right-auto sm:w-80">
                    <TripCalendar
                      days={days}
                      onSelectDay={(dayId) => {
                        setActiveDayId(dayId)
                        setShowCalendar(false)
                      }}
                    />
                  </div>
                )}

                <div className="pt-0.5">
                  {activeItems.length > 0 && (
                    <DayOptionsPanel
                      items={activeItems}
                      mustSeeIds={currentMustSeeIds}
                      voteSummary={voteSummary}
                      groupVoting={groupVoting}
                      view={dayOptionView}
                      onViewChange={setDayOptionView}
                    />
                  )}
                  {voteError && (
                    <p className="mb-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-xs font-semibold text-line-4">
                      {voteError}
                    </p>
                  )}
                  {activeDay ? (
                    <DayLine
                      day={activeDay}
                      items={displayedActiveItems}
                      color={activeColor}
                      selectedItemId={selectedItemId}
                      onSelectItem={(id) => {
                        setSelectedItemId(id)
                        mapRef.current?.resize()
                      }}
                      onAction={handleAction}
                      onEdit={setEditingItem}
                      onReorder={handleReorder}
                      onDelete={handleDelete}
                      onToggleMustSee={handleToggleMustSee}
                      getMapsUrl={mapsUrlForItem}
                      getBookingUrl={bookingUrlForItem}
                      mustSeeIds={currentMustSeeIds}
                      voteSummary={voteSummary}
                      groupVoting={groupVoting}
                      onAddClick={setAddModalDate}
                      travelMode={travelMode}
                      showCommutes={showRouteTools}
                    />
                  ) : (
                    <p className="text-text-dim">No days yet — add your first flight, stay, or activity.</p>
                  )}
                </div>
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

        <main className="relative min-h-0 flex-1 bg-map-bg">
          <TripMap
            ref={mapRef}
            days={days}
            items={mapItems}
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

          {displayedActiveItems.length > 1 && (
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

          <button
            type="button"
            onClick={() => setShowRouteTools((value) => !value)}
            aria-label={showRouteTools ? 'Hide route tools' : 'Show route tools'}
            className="absolute right-3 top-24 z-10 flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-border-strong shadow-lg transition-colors md:right-4 md:top-4"
            style={{
              background: showRouteTools ? activeColor : 'var(--color-surface)',
              color: showRouteTools ? '#070606' : 'var(--color-text-dim)',
            }}
          >
            <Route size={16} />
          </button>

          {showRouteTools && <TravelModePicker mode={travelMode} onChange={setTravelMode} color={activeColor} />}

          {showRouteTools && selectedItem && nextItem && (
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

      {showImportModal && (
        <ImportItineraryModal
          trip={trip}
          days={days}
          itemCount={items.length}
          onClose={() => setShowImportModal(false)}
          onDayCreated={handleDayCreated}
          onItemsCreated={(createdItems) => setItems((current) => [...current, ...createdItems])}
          onMustSeeCreated={(itemIds) => {
            if (!tripId || itemIds.length === 0) return
            setMustSeeIds((current) => {
              const next = new Set(current)
              itemIds.forEach((id) => next.add(id))
              saveMustSeeIds(tripId, next)
              return next
            })
          }}
        />
      )}

      {showEditTrip && <EditTripModal trip={trip} onClose={() => setShowEditTrip(false)} onSave={handleUpdateTrip} />}
      {showGroupTrip && session?.user.id && (
        <GroupTripModal trip={trip} userId={session.user.id} onClose={() => setShowGroupTrip(false)} />
      )}
      {showGroupPicks && (
        <GroupPicksModal
          days={days}
          items={items}
          voteSummary={voteSummary}
          onClose={() => setShowGroupPicks(false)}
          onSelectItem={(item) => {
            setActiveDayId(item.dayId)
            setSelectedItemId(item.id)
            setShowGroupPicks(false)
          }}
        />
      )}
    </div>
  )
}
