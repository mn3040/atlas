import { lazy, Suspense, useEffect, useRef, useState, type TouchEvent } from 'react'
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
  Radar,
  WifiOff,
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
import { supabase } from '../api/supabaseClient'
import { clearItemDecision, fetchItemDecisions, isMissingDecisionsTable, setItemDecision } from '../api/decisions'
import { fetchItemVoteSummary, setItemMustSeeVote } from '../api/votes'
import { addItemNote, deleteItemNote, fetchItemNotes, isMissingNotesTable } from '../api/notes'
import { TopNav } from '../components/TopNav'
import { TripSubNav } from '../components/TripSubNav'
import { useSession } from '../hooks/useSession'
import { useProfile } from '../hooks/useProfile'
import { CountryFlags } from '../components/CountryFlag'
import { DaySelect } from '../itinerary/DaySelect'
import { DayLine } from '../itinerary/DayLine'
import { DayOptionsPanel } from '../itinerary/DayOptionsPanel'
import { DayBranchesPanel } from '../itinerary/DayBranchesPanel'
import { BookingDetail } from '../itinerary/BookingDetail'
import { FlightDetail } from '../itinerary/FlightDetail'
import { AddItemModal } from '../itinerary/AddItemModal'
import type { TripMapHandle } from '../maps/TripMap'
import { TravelModePicker } from '../maps/TravelModePicker'
import { TransitCard } from '../maps/TransitCard'
import { DayPager } from '../maps/DayPager'
import { ZoomControl } from '../maps/ZoomControl'
import { WeatherChip } from '../maps/WeatherChip'
import { lineColorForIndex } from '../utils/lineColors'
import { actionForItem, bookingUrlForItem, mapsUrlForItem } from '../utils/itemActions'
import { downloadItinerary } from '../utils/exportItinerary'
import { APP_SETTINGS_EVENT, getAppSettings, shouldConfirmBeforeDelete } from '../utils/settings'
import { filterItemsForView, loadMustSeeIds, saveMustSeeIds } from '../utils/mustSee'
import { branchesForItems, filterItemsForBranch } from '../utils/branches'
import { countryCodesForTrip } from '../utils/flags'
import { loadOfflineTrip, saveOfflineTrip } from '../utils/offlineItinerary'
import type { TravelMode } from '../utils/distance'
import type { AppSettings } from '../utils/settings'
import type { DayOptionView } from '../utils/mustSee'
import type { Trip, Day, Item, TripVisibility, ItemVoteSummary, Profile, ItemDecision, ItemNote } from '../types/trip'

const ImportItineraryModal = lazy(() =>
  import('../itinerary/ImportItineraryModal').then((module) => ({ default: module.ImportItineraryModal })),
)
const EditTripModal = lazy(() =>
  import('../itinerary/EditTripModal').then((module) => ({ default: module.EditTripModal })),
)
const GroupTripModal = lazy(() =>
  import('../itinerary/GroupTripModal').then((module) => ({ default: module.GroupTripModal })),
)
const GroupPicksModal = lazy(() =>
  import('../itinerary/GroupPicksModal').then((module) => ({ default: module.GroupPicksModal })),
)
const StopNotesPanel = lazy(() =>
  import('../itinerary/StopNotesPanel').then((module) => ({ default: module.StopNotesPanel })),
)
const RecapCardModal = lazy(() =>
  import('../itinerary/RecapCardModal').then((module) => ({ default: module.RecapCardModal })),
)
const TripCalendar = lazy(() =>
  import('../calendar/TripCalendar').then((module) => ({ default: module.TripCalendar })),
)
const TripMap = lazy(() =>
  import('../maps/TripMap').then((module) => ({ default: module.TripMap })),
)

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatCacheTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
  const [loadError, setLoadError] = useState<string | null>(null)
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
  const [recapDayId, setRecapDayId] = useState<string | null>(null)
  const [dayOptionView, setDayOptionView] = useState<DayOptionView>('all')
  const [activeBranchByDay, setActiveBranchByDay] = useState<Record<string, string>>({})
  const [mustSeeIds, setMustSeeIds] = useState<Set<string>>(() => new Set())
  const [voteSummary, setVoteSummary] = useState<Record<string, ItemVoteSummary>>({})
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({})
  const [voteError, setVoteError] = useState<string | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, ItemNote[]>>({})
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesItemId, setNotesItemId] = useState<string | null>(null)
  const [postingNote, setPostingNote] = useState(false)
  const [screen, setScreen] = useState<'itinerary' | 'booking' | 'flight'>('itinerary')
  const [bookingItemId, setBookingItemId] = useState<string | null>(null)
  const [flightItemId, setFlightItemId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(12)
  const [editingDayLabel, setEditingDayLabel] = useState(false)
  const [dayLabelDraft, setDayLabelDraft] = useState('')
  const [isTouring, setIsTouring] = useState(false)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)
  const [showRouteTools, setShowRouteTools] = useState(false)
  const [offlineSnapshotAt, setOfflineSnapshotAt] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const mapRef = useRef<TripMapHandle>(null)
  const sheetRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null)

  useEffect(() => {
    if (!tripId) return
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [tripData, dayData, itemData] = await Promise.all([
          fetchTrip(tripId!),
          fetchDays(tripId!),
          fetchItems(tripId!),
        ])
        setTrip(tripData)
        setDays(dayData)
        setItems(itemData)
        setActiveDayId(dayData[0]?.id ?? null)
        setOfflineSnapshotAt(null)
        saveOfflineTrip(tripId!, { trip: tripData, days: dayData, items: itemData })
      } catch (err) {
        const cached = loadOfflineTrip(tripId!)
        if (cached) {
          setTrip(cached.trip)
          setDays(cached.days)
          setItems(cached.items)
          setActiveDayId(cached.days[0]?.id ?? null)
          setOfflineSnapshotAt(cached.savedAt)
        } else {
          setLoadError(err instanceof Error ? err.message : 'Failed to load this trip.')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripId])

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }
    function handleOffline() {
      setIsOffline(true)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!tripId) return
    setMustSeeIds(loadMustSeeIds(tripId))
  }, [tripId])

  useEffect(() => {
    if (!tripId || !session?.user.id || trip?.visibility !== 'group') {
      setVoteSummary({})
      setDecisions({})
      return
    }

    let cancelled = false
    setVoteError(null)
    setDecisionError(null)
    Promise.all([fetchItemVoteSummary(tripId, session.user.id), fetchItemDecisions(tripId)])
      .then(([summary, decisionData]) => {
        if (!cancelled) {
          setVoteSummary(summary)
          setDecisions(decisionData)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (isMissingDecisionsTable(err)) setDecisionError('Run the latest Supabase migration to enable locked group decisions.')
          else setVoteError(err instanceof Error ? err.message : 'Could not load group votes.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [tripId, session?.user.id, trip?.visibility])

  useEffect(() => {
    if (!tripId || !session?.user.id || trip?.visibility !== 'group') return

    let cancelled = false
    let refreshTimer: number | null = null
    const refreshVotes = () => {
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        fetchItemVoteSummary(tripId, session.user.id)
          .then((summary) => {
            if (!cancelled) setVoteSummary(summary)
          })
          .catch((err) => {
            if (!cancelled) setVoteError(err instanceof Error ? err.message : 'Could not refresh group votes.')
          })
      }, 160)
    }

    const channel = supabase
      .channel(`trip-votes:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_votes', filter: `trip_id=eq.${tripId}` },
        refreshVotes,
      )
      .subscribe()

    return () => {
      cancelled = true
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [tripId, session?.user.id, trip?.visibility])

  useEffect(() => {
    if (!tripId || trip?.visibility !== 'group') return

    let cancelled = false
    let refreshTimer: number | null = null
    const refreshDecisions = () => {
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        fetchItemDecisions(tripId)
          .then((decisionData) => {
            if (!cancelled) setDecisions(decisionData)
          })
          .catch((err) => {
            if (!cancelled && !isMissingDecisionsTable(err)) {
              setDecisionError(err instanceof Error ? err.message : 'Could not refresh group decisions.')
            }
          })
      }, 160)
    }

    const channel = supabase
      .channel(`trip-decisions:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_decisions', filter: `trip_id=eq.${tripId}` },
        refreshDecisions,
      )
      .subscribe()

    return () => {
      cancelled = true
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [tripId, trip?.visibility])

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    fetchItemNotes(tripId, session?.user.id ?? null)
      .then((notesByItem) => {
        if (!cancelled) setNotes(notesByItem)
      })
      .catch((err) => {
        if (!cancelled && !isMissingNotesTable(err)) {
          setNotesError(err instanceof Error ? err.message : 'Could not load stop notes.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [tripId, session?.user.id])

  useEffect(() => {
    if (!tripId) return

    let cancelled = false
    let refreshTimer: number | null = null
    const refreshNotes = () => {
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        fetchItemNotes(tripId, session?.user.id ?? null)
          .then((notesByItem) => {
            if (!cancelled) setNotes(notesByItem)
          })
          .catch((err) => {
            if (!cancelled && !isMissingNotesTable(err)) {
              setNotesError(err instanceof Error ? err.message : 'Could not refresh stop notes.')
            }
          })
      }, 160)
    }

    const channel = supabase
      .channel(`trip-notes:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_notes', filter: `trip_id=eq.${tripId}` },
        refreshNotes,
      )
      .subscribe()

    return () => {
      cancelled = true
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [tripId, session?.user.id])

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
  const voteCounts = Object.fromEntries(Object.entries(voteSummary).map(([id, summary]) => [id, summary.voters.length]))
  const dayBranches = branchesForItems(activeItems, currentMustSeeIds, voteCounts)
  const activeBranchId = activeDayId ? activeBranchByDay[activeDayId] ?? 'all' : 'all'
  const branchedActiveItems = filterItemsForBranch(displayedActiveItems, activeBranchId)
  const branchDisplayedIds = new Set(branchedActiveItems.map((item) => item.id))
  const mapItems =
    dayOptionView === 'all'
      ? activeBranchId === 'all'
        ? items
        : items.filter((item) => item.dayId !== activeDayId || item.type === 'stay' || branchDisplayedIds.has(item.id))
      : items.filter((item) => item.dayId !== activeDayId || item.type === 'stay' || branchDisplayedIds.has(item.id))

  useEffect(() => {
    if (!branchedActiveItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(branchedActiveItems[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayId, items, dayOptionView, mustSeeIds, voteSummary, activeBranchId])

  // Auto-tour: step through the day's stops on a timer, reusing the same
  // selection -> flyTo/highlight path a manual click already triggers. The
  // route line between stops already reflects whichever travel mode is
  // selected, so switching mode mid-tour changes what the tour shows.
  useEffect(() => {
    if (!isTouring || branchedActiveItems.length < 2) return
    const timer = window.setInterval(() => {
      setSelectedItemId((current) => {
        const index = branchedActiveItems.findIndex((item) => item.id === current)
        const nextIndex = (index + 1) % branchedActiveItems.length
        return branchedActiveItems[nextIndex].id
      })
    }, 2800)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouring, activeDayId, branchedActiveItems.length])

  useEffect(() => {
    setIsTouring(false)
  }, [activeDayId])

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.resize(true), 90)
    return () => window.clearTimeout(timer)
  }, [mobileSheetExpanded])

  const selectedIndex = branchedActiveItems.findIndex((item) => item.id === selectedItemId)
  const nextItem = selectedIndex >= 0 ? branchedActiveItems[selectedIndex + 1] : undefined
  const selectedItem = selectedIndex >= 0 ? branchedActiveItems[selectedIndex] : undefined
  const bookingItem = items.find((item) => item.id === bookingItemId) ?? null
  const flightItem = items.find((item) => item.id === flightItemId) ?? null
  const notesItem = items.find((item) => item.id === notesItemId) ?? null
  const noteCounts = Object.fromEntries(Object.entries(notes).map(([itemId, list]) => [itemId, list.length]))
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

  async function handleAddNote(body: string) {
    if (!tripId || !notesItemId || !session?.user.id) return
    setPostingNote(true)
    setNotesError(null)
    try {
      const note = await addItemNote({
        tripId,
        itemId: notesItemId,
        userId: session.user.id,
        displayName: profile?.displayName ?? 'You',
        avatarColor: profile?.avatarColor ?? '#22dd85',
        body,
      })
      setNotes((current) => ({ ...current, [notesItemId]: [...(current[notesItemId] ?? []), note] }))
    } catch (err) {
      setNotesError(
        isMissingNotesTable(err)
          ? 'Run the latest Supabase migration to enable stop notes.'
          : err instanceof Error
            ? err.message
            : 'Could not post this note.',
      )
    } finally {
      setPostingNote(false)
    }
  }

  async function handleDeleteNote(id: string) {
    if (!notesItemId) return
    setNotesError(null)
    try {
      await deleteItemNote(id)
      setNotes((current) => ({
        ...current,
        [notesItemId]: (current[notesItemId] ?? []).filter((note) => note.id !== id),
      }))
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Could not delete this note.')
    }
  }

  async function handleDecide(item: Item) {
    if (!trip || !session?.user.id || !item.dayId) return
    setDecisionError(null)
    try {
      const decision = await setItemDecision({ tripId: trip.id, dayId: item.dayId, itemId: item.id, userId: session.user.id })
      setDecisions((current) => ({ ...current, [decision.dayId]: decision }))
    } catch (err) {
      setDecisionError(isMissingDecisionsTable(err) ? 'Run the latest Supabase migration to enable locked group decisions.' : err instanceof Error ? err.message : 'Could not lock this pick.')
    }
  }

  async function handleClearDecision(dayId: string) {
    setDecisionError(null)
    try {
      await clearItemDecision(dayId)
      setDecisions((current) => {
        const next = { ...current }
        delete next[dayId]
        return next
      })
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Could not unlock this pick.')
    }
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
    return <div className="flex min-h-screen items-center justify-center text-sm text-text-dim">Loading...</div>
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-text-dim">
        {loadError ? `Could not load this trip: ${loadError}` : 'Trip not found.'}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-text [height:100dvh]">
      <TopNav subtitle={`${trip.name} · Itinerary`} />

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          ref={sheetRef}
          onTouchStart={handleSheetTouchStart}
          onTouchEnd={handleSheetTouchEnd}
          className={`itinerary-scroll atlas-reveal absolute inset-x-0 bottom-0 z-20 flex min-h-0 w-full shrink-0 touch-pan-y flex-col overflow-y-auto overscroll-contain rounded-t-lg border border-border-strong bg-surface/95 backdrop-blur-sm transition-[height,transform] duration-300 md:relative md:inset-auto md:z-auto md:h-auto md:w-[400px] md:flex-none md:overflow-hidden md:rounded-none md:border-y-0 md:border-l-0 md:border-r ${
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
                  <Link to={`/trips/${tripId}`} className="flex items-center gap-2 text-xs font-semibold text-text-dim hover:text-text">
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
                          <div className="absolute right-0 top-6 z-30 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]">
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
                            <Link
                              to={`/trips/${tripId}/command`}
                              onClick={() => setShowMenu(false)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text hover:bg-surface-2"
                            >
                              <Radar size={13} /> Command tab
                            </Link>
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

                {(isOffline || offlineSnapshotAt) && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-2xs font-semibold text-text-dim">
                    <WifiOff size={13} className="shrink-0 text-paper" />
                    <span>
                      {offlineSnapshotAt
                        ? `Offline -- showing itinerary cached ${formatCacheTime(offlineSnapshotAt)}`
                        : "You're offline -- changes won't sync until you're back online"}
                    </span>
                  </div>
                )}

                {/* Tier 1: primary trip identity -- name and flags only. */}
                <div className="mb-1.5 flex items-start gap-2">
                  <CountryFlags countryCodes={tripCountryCodes} className="mt-1.5 h-4 w-auto shrink-0 rounded-[1px]" />
                  <h1 className="min-w-0 font-display text-xl font-extrabold leading-tight tracking-tight text-text sm:text-2xl">
                    {trip.name}
                  </h1>
                </div>
                {trip.description && (
                  <p className="mb-3.5 text-xs leading-relaxed text-text-dim">{trip.description}</p>
                )}

                <div className="mb-3.5">
                  <TripSubNav tripId={tripId!} dense />
                </div>

                {/* Tier 2: secondary metadata and controls -- set apart from the
                    identity above with its own bar instead of bleeding into one row. */}
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
                  <span className="font-mono text-2xs font-semibold text-text">
                    {formatShortDate(trip.startDate)} – {formatShortDate(trip.endDate)}
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span className="text-2xs text-text-dim">
                    {days.length} day{days.length === 1 ? '' : 's'} · {items.length} stop{items.length === 1 ? '' : 's'}
                  </span>
                  <div className="flex-1" />
                  {activeDayId && <DaySelect days={days} activeDayId={activeDayId} onSelect={setActiveDayId} />}
                </div>

                {stays.length > 0 && (
                  <div className="mb-4 space-y-2 border-t border-border pt-3">
                    <p className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wide text-text-dimmer">
                      <BedDouble size={12} /> Where you're staying
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
                          <p className="truncate text-sm font-bold text-text">{stay.name}</p>
                          <p className="font-mono text-2xs text-text-dim">
                            {formatShortDate(stay.startDate)} – {formatShortDate(stay.endDate ?? stay.startDate)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mb-0.5 flex items-center justify-between">
                  <p className="font-mono text-2xs font-semibold text-text-dimmer">
                    Day {activeDayIndex + 1} / {activeDay ? formatShortDate(activeDay.date) : ''}
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
                  <div className="absolute left-4 right-4 top-16 z-20 rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-overlay)] sm:left-[22px] sm:right-auto sm:w-80">
                    <Suspense fallback={<p className="py-4 text-center text-xs font-semibold text-text-dim">Loading calendar...</p>}>
                      <TripCalendar
                        days={days}
                        onSelectDay={(dayId) => {
                          setActiveDayId(dayId)
                          setShowCalendar(false)
                        }}
                      />
                    </Suspense>
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
                  <DayBranchesPanel
                    branches={dayBranches}
                    activeBranchId={activeBranchId}
                    onSelectBranch={(branchId) => {
                      if (!activeDayId) return
                      setActiveBranchByDay((current) => ({ ...current, [activeDayId]: branchId }))
                    }}
                  />
                  {voteError && (
                    <p className="mb-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-xs font-semibold text-line-4">
                      {voteError}
                    </p>
                  )}
                  {activeDay ? (
                    <DayLine
                      day={activeDay}
                      items={branchedActiveItems}
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
                      onOpenNotes={(item) => {
                        setNotesError(null)
                        setNotesItemId(item.id)
                      }}
                      getMapsUrl={mapsUrlForItem}
                      getBookingUrl={bookingUrlForItem}
                      mustSeeIds={currentMustSeeIds}
                      voteSummary={voteSummary}
                      groupVoting={groupVoting}
                      noteCounts={noteCounts}
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

        <main className="atlas-map-stage relative min-h-0 flex-1 overflow-hidden bg-map-bg">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-map-bg text-sm font-semibold text-text-dim">Loading map...</div>}>
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
          </Suspense>

          {activeDay && (
            <DayPager
              label={`Day ${activeDayIndex + 1} · ${formatShortDate(activeDay.date)}`}
              onPrev={() => goToDay(-1)}
              onNext={() => goToDay(1)}
            />
          )}

          {branchedActiveItems.length > 1 && (
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

          <WeatherChip item={selectedItem ?? branchedActiveItems[0]} date={activeDay?.date} />

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
        <Suspense fallback={<p className="fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-dim">Loading import tools...</p>}>
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
        </Suspense>
      )}

      {showEditTrip && (
        <Suspense fallback={<ModalLoading />}>
          <EditTripModal trip={trip} onClose={() => setShowEditTrip(false)} onSave={handleUpdateTrip} />
        </Suspense>
      )}
      {showGroupTrip && session?.user.id && (
        <Suspense fallback={<ModalLoading />}>
          <GroupTripModal trip={trip} userId={session.user.id} onClose={() => setShowGroupTrip(false)} />
        </Suspense>
      )}
      {notesItem && (
        <Suspense fallback={<ModalLoading />}>
          <StopNotesPanel
            item={notesItem}
            notes={notes[notesItem.id] ?? []}
            currentUserId={session?.user.id ?? null}
            canModerate={trip.ownerId === session?.user.id}
            posting={postingNote}
            error={notesError}
            onClose={() => setNotesItemId(null)}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
          />
        </Suspense>
      )}

      {showGroupPicks && (
        <Suspense fallback={<ModalLoading />}>
          <GroupPicksModal
            days={days}
            items={items}
            voteSummary={voteSummary}
            decisions={decisions}
            memberCount={trip.memberLimit ?? 0}
            canDecide={trip.ownerId === session?.user.id}
            decisionError={decisionError}
            onClose={() => setShowGroupPicks(false)}
            onSelectItem={(item) => {
              setActiveDayId(item.dayId)
              setSelectedItemId(item.id)
              setShowGroupPicks(false)
            }}
            onDecide={handleDecide}
            onClearDecision={handleClearDecision}
            onShareDay={(dayId) => setRecapDayId(dayId)}
          />
        </Suspense>
      )}

      {recapDayId && trip && session?.user.id && (() => {
        const dayIndex = days.findIndex((candidate) => candidate.id === recapDayId)
        const day = days[dayIndex]
        if (!day) return null
        const dayItems = items
          .filter((item) => item.dayId === recapDayId && item.type === 'activity')
          .sort((a, b) => a.position - b.position)
        return (
          <Suspense fallback={<ModalLoading />}>
            <RecapCardModal
              mode="day"
              trip={trip}
              userId={session.user.id}
              day={day}
              dayIndex={dayIndex}
              dayItems={dayItems}
              decision={decisions[recapDayId] ?? null}
              voteSummary={voteSummary}
              onClose={() => setRecapDayId(null)}
            />
          </Suspense>
        )
      })()}
    </div>
  )
}

function ModalLoading() {
  return (
    <p className="fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-dim">
      Loading...
    </p>
  )
}
