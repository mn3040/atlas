import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, CalendarCheck, ChevronLeft, Clock3, FileText, MapPin, Plus, Radar, Share2, Users, UserRound } from 'lucide-react'
import { fetchTrip, fetchDays, fetchItems } from '../api/trips'
import { fetchTripMembers } from '../api/groupTrips'
import { fetchExpenses, isMissingExpensesTable } from '../api/budget'
import { fetchDocuments, isMissingDocumentsTable } from '../api/documents'
import { fetchPackingItems, isMissingPackingTable } from '../api/packing'
import { fetchItemVoteSummary } from '../api/votes'
import { fetchItemDecisions } from '../api/decisions'
import { TopNav } from '../components/TopNav'
import { TripSubNav } from '../components/TripSubNav'
import { CountryFlags } from '../components/CountryFlag'
import { WeatherChip } from '../maps/WeatherChip'
import { useSession } from '../hooks/useSession'
import { scheduleInsightsForItems } from '../utils/scheduleInsights'
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, categoryLabel, computeBalances, formatCurrency, simplifyDebts } from '../utils/budget'
import { expiryStatus } from '../utils/documentExpiry'
import { computeReadiness } from '../utils/readiness'
import { openVoteDaysForTrip } from '../utils/openVotes'
import { getAppSettings } from '../utils/settings'
import { countryCodesForTrip } from '../utils/flags'
import { CATEGORY_COLORS as ACTIVITY_CATEGORY_COLORS, CATEGORY_LABELS } from '../utils/categoryIcons'
import { formatTime } from '../utils/time'
import type {
  Day,
  Expense,
  Item,
  ItemDecision,
  ItemVoteSummary,
  PackingItem,
  Trip,
  TripDocument,
  TripMemberWithProfile,
} from '../types/trip'

const TripMap = lazy(() => import('../maps/TripMap').then((module) => ({ default: module.TripMap })))
const GroupTripModal = lazy(() => import('../itinerary/GroupTripModal').then((module) => ({ default: module.GroupTripModal })))
const RecapCardModal = lazy(() => import('../itinerary/RecapCardModal').then((module) => ({ default: module.RecapCardModal })))

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Scroll-triggered reveal for sections that sit below the fold on a
 * populated trip dashboard -- mirrors the timing of the mount-time
 * atlas-reveal keyframe above the fold, just driven by viewport entry
 * instead of mount. framer-motion resolves whileInView instantly, and skips
 * the transform, for prefers-reduced-motion on its own. */
const fadeInView = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function nameFor(members: TripMemberWithProfile[], userId: string): string {
  return members.find((member) => member.userId === userId)?.displayName ?? 'Traveler'
}

function colorFor(members: TripMemberWithProfile[], userId: string): string {
  return members.find((member) => member.userId === userId)?.avatarColor ?? '#22dd85'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function dotColorForItem(item: Item): string {
  if (item.type === 'flight') return 'var(--color-line-3)'
  if (item.category) return ACTIVITY_CATEGORY_COLORS[item.category]
  return 'var(--color-text-dimmer)'
}

export default function TripDashboard() {
  const { tripId } = useParams<{ tripId: string }>()
  const { session } = useSession()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [members, setMembers] = useState<TripMemberWithProfile[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [documents, setDocuments] = useState<TripDocument[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [voteSummary, setVoteSummary] = useState<Record<string, ItemVoteSummary>>({})
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showGroupTrip, setShowGroupTrip] = useState(false)
  const [showRecap, setShowRecap] = useState(false)

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [tripData, dayData, itemData, memberData] = await Promise.all([
          fetchTrip(tripId!),
          fetchDays(tripId!),
          fetchItems(tripId!),
          fetchTripMembers(tripId!),
        ])
        if (cancelled) return
        setTrip(tripData)
        setDays(dayData)
        setItems(itemData)
        setMembers(memberData)

        const isGroup = tripData.visibility === 'group'
        const [expenseResult, documentResult, packingResult, voteResult, decisionResult] = await Promise.all([
          fetchExpenses(tripId!).catch((err) => (isMissingExpensesTable(err) ? [] : Promise.reject(err))),
          fetchDocuments(tripId!).catch((err) => (isMissingDocumentsTable(err) ? [] : Promise.reject(err))),
          fetchPackingItems(tripId!).catch((err) => (isMissingPackingTable(err) ? [] : Promise.reject(err))),
          isGroup && session?.user.id ? fetchItemVoteSummary(tripId!, session.user.id) : Promise.resolve({}),
          isGroup ? fetchItemDecisions(tripId!) : Promise.resolve({}),
        ])
        if (cancelled) return
        setExpenses(expenseResult)
        setDocuments(documentResult)
        setPackingItems(packingResult)
        setVoteSummary(voteResult)
        setDecisions(decisionResult)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load this trip.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tripId, session?.user.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
          <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-surface-3" />
          <div className="mb-5 h-6 w-40 animate-pulse rounded-full bg-surface-3" />
          <div className="mb-5 animate-pulse rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 h-3 w-20 rounded-full bg-surface-3" />
            <div className="h-8 w-32 rounded-full bg-surface-3" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !trip || !tripId) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-text-dim">
          {loadError ?? 'Trip not found.'}
        </div>
      </div>
    )
  }

  const groupVoting = trip.visibility === 'group'
  const travelMode = getAppSettings().defaultTravelMode
  const tripCountryCodes = countryCodesForTrip(trip, items)

  const activeItems = items.filter((item) => item.type !== 'stay')
  const missingTimes = activeItems.filter((item) => !item.startTime)
  const missingLocations = items.filter((item) => !item.locationLabel || (item.lat === 0 && item.lng === 0))
  const votedItems = items.filter((item) => (voteSummary[item.id]?.voters.length ?? 0) > 0)
  const scheduleFlags = days.flatMap((day) => scheduleInsightsForItems(items.filter((item) => item.dayId === day.id), travelMode))
  const packedCount = packingItems.filter((item) => item.packed).length

  const readiness = computeReadiness({
    activeItemsTotal: activeItems.length,
    missingTimesCount: missingTimes.length,
    itemsTotal: items.length,
    missingLocationsCount: missingLocations.length,
    groupVoting,
    votedItemsCount: votedItems.length,
    packingItemsTotal: packingItems.length,
    packedCount,
  })

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const today = todayIso()
  const todayDay = sortedDays.find((d) => d.date === today) ?? sortedDays.find((d) => d.date >= today) ?? sortedDays[sortedDays.length - 1] ?? null
  const todayDayIndex = todayDay ? days.findIndex((d) => d.id === todayDay.id) : -1
  const todayItems = todayDay
    ? items.filter((item) => item.dayId === todayDay.id && item.type !== 'stay').sort((a, b) => a.position - b.position)
    : []
  const todayTitle = todayDay ? `Today — Day ${todayDayIndex + 1}${todayDay.label ? ` · ${todayDay.label}` : ''}` : 'Today'

  const totalSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const categoryTotals = EXPENSE_CATEGORIES.map((entry) => ({
    id: entry.id,
    amount: expenses.filter((expense) => expense.category === entry.id).reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((entry) => entry.amount > 0)
  const isGroupBudget = groupVoting && members.length > 1
  const balances = isGroupBudget ? computeBalances(expenses, members.map((member) => member.userId)) : {}
  const transfers = isGroupBudget ? simplifyDebts(balances) : []
  const topTransfer = transfers[0]

  const topDocuments = [...documents]
    .sort((a, b) => {
      if (!a.expiryDate) return 1
      if (!b.expiryDate) return -1
      return a.expiryDate.localeCompare(b.expiryDate)
    })
    .slice(0, 2)

  const openVoteDays = groupVoting ? openVoteDaysForTrip(days, items, voteSummary, decisions) : []
  const decidedCount = Object.keys(decisions).length

  return (
    <div className="min-h-screen bg-ink">
      <TopNav subtitle={`${trip.name} · Dashboard`} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
        <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-text-dim hover:text-text">
          <ChevronLeft size={14} /> All trips
        </Link>

        <div className="atlas-reveal mb-2 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-paper">Atlas planboard</p>
            <div className="mb-1.5 flex items-center gap-2">
              <CountryFlags countryCodes={tripCountryCodes} className="h-4 w-auto shrink-0 rounded-[1px]" />
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-text sm:text-3xl">{trip.name}</h1>
            </div>
            {trip.description && <p className="text-sm leading-relaxed text-text-dim">{trip.description}</p>}
          </div>
          <TripSubNav tripId={tripId} />
        </div>

        <div className="atlas-reveal mb-5 flex flex-wrap items-center gap-2 text-2xs font-bold uppercase tracking-wide text-text-dim">
          <span className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono normal-case tracking-normal">
            {formatShortDate(trip.startDate)} – {formatShortDate(trip.endDate)}
          </span>
          <span className="rounded-md border border-border bg-surface px-2.5 py-1">
            {trip.visibility === 'group' ? `Group${trip.memberLimit ? ` · ${members.length}/${trip.memberLimit}` : ''}` : 'Personal'}
          </span>
        </div>

        <section className="atlas-reveal mb-5 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm font-extrabold text-text">
              <Radar size={16} className="text-green" /> Trip readiness
            </span>
            <span className="rounded-md bg-ink px-2 py-1 text-sm font-extrabold text-green">{readiness}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink">
            <div className="h-full rounded-full bg-green" style={{ width: `${readiness}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-dim">
            Scheduled stops, usable locations, group vote coverage, and packing progress, in one score.
          </p>
        </section>

        <div className="atlas-reveal mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile icon={CalendarCheck} label="Days" value={days.length} />
          <StatTile icon={MapPin} label="Stops" value={items.length} />
          <StatTile icon={Clock3} label="Missing times" value={missingTimes.length} warning={missingTimes.length > 0} />
          <StatTile icon={AlertTriangle} label="Timing flags" value={scheduleFlags.length} warning={scheduleFlags.length > 0} />
        </div>

        <div className="atlas-reveal mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-text">{todayTitle}</span>
              <Link to={`/trips/${tripId}/itinerary`} className="shrink-0 text-2xs font-bold text-green hover:text-paper">
                Full itinerary →
              </Link>
            </div>
            {todayItems.length === 0 ? (
              <p className="text-xs text-text-dim">Nothing scheduled for today yet.</p>
            ) : (
              <div>
                {todayItems.map((item) => (
                  <div key={item.id} className="flex gap-3 border-t border-border py-2.5 first:border-t-0">
                    <span className="w-11 shrink-0 pt-0.5 font-mono text-xs font-semibold text-text-dim">
                      {item.startTime ? formatTime(item.startTime) : '--:--'}
                    </span>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dotColorForItem(item) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-text">{item.name}</span>
                        {item.category && (
                          <span className="shrink-0 text-3xs font-bold uppercase tracking-wide text-text-dimmer">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        )}
                      </div>
                      {item.locationLabel && <p className="mt-0.5 truncate text-xs text-text-dim">{item.locationLabel}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative h-[190px] overflow-hidden rounded-lg border border-border bg-map-bg">
              <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-text-dim">Loading map...</div>}>
                <TripMap
                  days={days}
                  items={items}
                  activeDayId={todayDay?.id ?? null}
                  selectedItemId={null}
                  travelMode={travelMode}
                  onSelectItem={() => {}}
                  onZoomChange={() => {}}
                />
              </Suspense>
              <WeatherChip item={todayItems[0]} date={todayDay?.date} compact />
              <Link
                to={`/trips/${tripId}/itinerary`}
                className="absolute bottom-2 right-2 z-10 rounded-md border border-border-strong bg-surface/90 px-2.5 py-1 text-2xs font-bold text-text backdrop-blur-sm hover:border-paper hover:text-paper"
              >
                Open map →
              </Link>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-3xs font-bold uppercase tracking-[0.2em] text-text-dimmer">Trip spend</p>
                <Link to={`/trips/${tripId}/budget`} className="shrink-0 text-2xs font-bold text-green hover:text-paper">
                  Open budget hub →
                </Link>
              </div>
              <p className="mb-3 font-mono text-2xl font-extrabold text-text">{formatCurrency(totalSpend)}</p>
              {totalSpend > 0 ? (
                <>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-ink">
                    {categoryTotals.map((entry) => (
                      <div key={entry.id} style={{ width: `${(entry.amount / totalSpend) * 100}%`, background: CATEGORY_COLORS[entry.id] }} />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categoryTotals.map((entry) => (
                      <span key={entry.id} className="flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-2xs font-semibold text-text-dim">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[entry.id] }} />
                        {categoryLabel(entry.id)} · {formatCurrency(entry.amount)}
                      </span>
                    ))}
                  </div>
                  {topTransfer && (
                    <p className="mt-3 border-t border-border pt-3 text-xs font-semibold text-text">
                      <span style={{ color: colorFor(members, topTransfer.from) }}>{nameFor(members, topTransfer.from)}</span> owes{' '}
                      <span style={{ color: colorFor(members, topTransfer.to) }}>{nameFor(members, topTransfer.to)}</span>{' '}
                      <span className="font-mono">{formatCurrency(topTransfer.amount)}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-text-dim">No expenses logged yet.</p>
              )}
            </div>
          </div>
        </div>

        <motion.div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]" {...fadeInView}>
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-text">Document wallet</span>
              <Link to={`/trips/${tripId}/documents`} className="shrink-0 text-2xs font-bold text-green hover:text-paper">
                Open wallet →
              </Link>
            </div>
            {topDocuments.length === 0 ? (
              <p className="text-xs text-text-dim">No documents added yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {topDocuments.map((document) => {
                  const status = expiryStatus(document.expiryDate)
                  return (
                    <div key={document.id} className="atlas-ticket-stub flex overflow-hidden rounded-md border border-border bg-surface-2">
                      <div className="flex w-16 shrink-0 items-center justify-center border-r-2 border-dashed border-border-strong py-3">
                        <FileText size={18} className="text-paper" />
                      </div>
                      <div className="min-w-0 flex-1 p-3">
                        <p className="truncate text-xs font-bold text-text">{document.title}</p>
                        <p
                          className="mt-1 font-mono text-3xs font-bold"
                          style={{
                            color:
                              status.tone === 'expired'
                                ? 'var(--color-line-4)'
                                : status.tone === 'soon'
                                  ? 'var(--color-paper)'
                                  : 'var(--color-text-dimmer)',
                          }}
                        >
                          {status.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-3xs font-bold uppercase tracking-[0.2em] text-text-dimmer">Packed</p>
                <Link to={`/trips/${tripId}/packing`} className="shrink-0 text-2xs font-bold text-green hover:text-paper">
                  Open packing list →
                </Link>
              </div>
              <p className="mb-2 font-mono text-xl font-extrabold text-text">
                {packedCount}
                <span className="text-sm text-text-dimmer"> / {packingItems.length}</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                <div
                  className="h-full rounded-full bg-green"
                  style={{ width: `${packingItems.length ? Math.round((packedCount / packingItems.length) * 100) : 0}%` }}
                />
              </div>
            </div>

            {groupVoting && openVoteDays.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <p className="mb-2 text-3xs font-bold uppercase tracking-[0.2em] text-text-dimmer">Open votes</p>
                <div className="flex items-center justify-between gap-2 rounded-md bg-ink px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-text">{openVoteDays[0].topPick.item.name}</p>
                    <p className="mt-0.5 text-3xs text-text-dim">
                      {openVoteDays[0].dayLabel} · {openVoteDays[0].topPick.votes} vote{openVoteDays[0].topPick.votes === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Link to={`/trips/${tripId}/itinerary`} className="shrink-0 text-3xs font-bold text-green hover:text-paper">
                    Decide
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {trip.visibility === 'group' && (
          <motion.div className="rounded-lg border border-border bg-surface p-4 sm:p-5" {...fadeInView}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-extrabold text-text">
                <Users size={15} className="text-green" /> Travelers
              </span>
              {session?.user.id && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRecap(true)}
                    disabled={decidedCount === 0}
                    title={decidedCount === 0 ? "Lock a day's pick first" : 'Share the plan'}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-ink px-3 py-1.5 text-xs font-bold text-text hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Share2 size={14} /> Share plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGroupTrip(true)}
                    className="flex items-center gap-1.5 rounded-md bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper-dim"
                  >
                    <Plus size={14} /> Invite
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {members.length === 0 ? (
                <p className="text-xs text-text-dim">No travelers yet.</p>
              ) : (
                members.map((member) => (
                  <div key={member.userId} className="flex items-center gap-2 rounded-md bg-ink px-2.5 py-1.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-3xs font-extrabold uppercase"
                      style={{
                        background: member.avatarColor,
                        color: member.avatarColor === '#f7ff88' || member.avatarColor === '#fefefe' ? '#070606' : '#fefefe',
                      }}
                    >
                      {initials(member.displayName) || <UserRound size={11} />}
                    </span>
                    <span className="text-xs font-bold text-text">{member.displayName}</span>
                  </div>
                ))
              )}
            </div>
            {showGroupTrip && session?.user.id && (
              <Suspense fallback={null}>
                <GroupTripModal trip={trip} userId={session.user.id} onClose={() => setShowGroupTrip(false)} />
              </Suspense>
            )}
            {showRecap && session?.user.id && (
              <Suspense fallback={null}>
                <RecapCardModal
                  mode="trip"
                  trip={trip}
                  userId={session.user.id}
                  days={days}
                  items={items}
                  decisions={decisions}
                  members={members}
                  onClose={() => setShowRecap(false)}
                />
              </Suspense>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: typeof MapPin
  label: string
  value: number
  warning?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-lg font-extrabold text-text">
        <Icon size={14} className={warning ? 'text-line-4' : 'text-green'} /> {value}
      </p>
      <p className="text-3xs font-bold uppercase tracking-wide text-text-dim">{label}</p>
    </div>
  )
}
