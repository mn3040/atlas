import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Backpack,
  CalendarCheck,
  ChevronLeft,
  Clock3,
  FileWarning,
  MapPin,
  Radar,
  Star,
  Wallet,
} from 'lucide-react'
import { fetchTrip, fetchDays, fetchItems } from '../api/trips'
import { fetchTripMembers } from '../api/groupTrips'
import { fetchExpenses, isMissingExpensesTable } from '../api/budget'
import { fetchDocuments, isMissingDocumentsTable } from '../api/documents'
import { fetchPackingItems, isMissingPackingTable } from '../api/packing'
import { fetchItemVoteSummary } from '../api/votes'
import { fetchItemDecisions } from '../api/decisions'
import { TopNav } from '../components/TopNav'
import { TripSubNav } from '../components/TripSubNav'
import { useSession } from '../hooks/useSession'
import { scheduleInsightsForItems } from '../utils/scheduleInsights'
import { computeBalances, formatCurrency, simplifyDebts } from '../utils/budget'
import { expiryStatus } from '../utils/documentExpiry'
import { computeReadiness } from '../utils/readiness'
import { openVoteDaysForTrip } from '../utils/openVotes'
import { getAppSettings } from '../utils/settings'
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

function nameFor(members: TripMemberWithProfile[], userId: string): string {
  return members.find((member) => member.userId === userId)?.displayName ?? 'Traveler'
}

export default function CommandTab() {
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
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7">
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

  const activeItems = items.filter((item) => item.type !== 'stay')
  const missingTimes = activeItems.filter((item) => !item.startTime)
  const missingLocations = items.filter((item) => !item.locationLabel || (item.lat === 0 && item.lng === 0))
  const votedItems = items.filter((item) => (voteSummary[item.id]?.voters.length ?? 0) > 0)

  const scheduleFlags = days.flatMap((day, index) => {
    const dayItems = items.filter((item) => item.dayId === day.id)
    return scheduleInsightsForItems(dayItems, travelMode).map((insight) => ({
      ...insight,
      dayLabel: day.label || `Day ${index + 1}`,
    }))
  })

  const openVoteDays = groupVoting ? openVoteDaysForTrip(days, items, voteSummary, decisions) : []

  const isGroupBudget = groupVoting && members.length > 1
  const totalSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const balances = isGroupBudget ? computeBalances(expenses, members.map((member) => member.userId)) : {}
  const transfers = isGroupBudget ? simplifyDebts(balances) : []

  const flaggedDocuments = documents
    .map((document) => ({ document, status: expiryStatus(document.expiryDate) }))
    .filter((entry) => entry.status.tone === 'expired' || entry.status.tone === 'soon')
    .sort((a, b) => (a.document.expiryDate ?? '').localeCompare(b.document.expiryDate ?? ''))

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

  return (
    <div className="min-h-screen bg-ink">
      <TopNav subtitle={`${trip.name} · Command`} />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7">
        <Link to={`/trips/${tripId}`} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-text-dim hover:text-text">
          <ChevronLeft size={14} /> {trip.name}
        </Link>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-green">Command tab</p>
            <h1 className="font-display text-xl font-extrabold text-text">{trip.name}</h1>
          </div>
          <TripSubNav tripId={tripId} />
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

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile icon={CalendarCheck} label="Days" value={days.length} />
          <StatTile icon={MapPin} label="Stops" value={items.length} />
          <StatTile icon={Clock3} label="Missing times" value={missingTimes.length} warning={missingTimes.length > 0} />
          <StatTile icon={AlertTriangle} label="Timing flags" value={scheduleFlags.length} warning={scheduleFlags.length > 0} />
        </div>

        <SectionCard
          title="Schedule flags"
          icon={AlertTriangle}
          empty="No timing conflicts or long transfers on the current route."
        >
          {scheduleFlags.slice(0, 8).map((insight) => (
            <div key={insight.id} className="rounded-md bg-ink px-3 py-2">
              <p className="flex items-center justify-between gap-2 text-xs font-bold text-text">
                {insight.title}
                <span className="font-mono text-3xs font-semibold text-text-dimmer">{insight.dayLabel}</span>
              </p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-text-dim">{insight.detail}</p>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Needs info" icon={MapPin} empty="Every stop has a time and a usable location.">
          {missingTimes.length + missingLocations.length > 0 && (
            <>
              {missingTimes.slice(0, 5).map((item) => (
                <p key={`time-${item.id}`} className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-text">
                  {item.name} <span className="font-normal text-text-dim">— no time set</span>
                </p>
              ))}
              {missingLocations.slice(0, 5).map((item) => (
                <p key={`loc-${item.id}`} className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-text">
                  {item.name} <span className="font-normal text-text-dim">— no usable location</span>
                </p>
              ))}
            </>
          )}
        </SectionCard>

        {groupVoting && (
          <SectionCard title="Open votes" icon={Star} empty="Every day with votes has a locked pick.">
            {openVoteDays.map(({ dayLabel, topPick }) => (
              <div key={dayLabel} className="flex items-center justify-between gap-2 rounded-md bg-ink px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-text">{topPick.item.name}</p>
                  <p className="text-3xs text-text-dim">{dayLabel} · {topPick.votes} vote{topPick.votes === 1 ? '' : 's'}</p>
                </div>
                <Link to={`/trips/${tripId}/itinerary`} className="shrink-0 text-3xs font-bold text-green hover:text-paper">
                  Decide
                </Link>
              </div>
            ))}
          </SectionCard>
        )}

        <SectionCard
          title="Budget"
          icon={Wallet}
          empty={expenses.length === 0 ? 'No expenses logged yet.' : 'Everyone is settled up.'}
          footer={
            <Link to={`/trips/${tripId}/budget`} className="text-3xs font-bold text-green hover:text-paper">
              Open budget hub →
            </Link>
          }
        >
          {expenses.length > 0 && (
            <div className="flex items-center justify-between rounded-md bg-ink px-3 py-2">
              <span className="text-xs font-semibold text-text-dim">Trip spend</span>
              <span className="font-mono text-sm font-extrabold text-text">{formatCurrency(totalSpend)}</span>
            </div>
          )}
          {transfers.map((transfer, index) => (
            <p key={index} className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-text">
              <span className="text-text-dim">{nameFor(members, transfer.from)} owes {nameFor(members, transfer.to)}</span>{' '}
              <span className="font-mono">{formatCurrency(transfer.amount)}</span>
            </p>
          ))}
        </SectionCard>

        <SectionCard
          title="Documents"
          icon={FileWarning}
          empty="Nothing expiring in the next 90 days."
          footer={
            <Link to={`/trips/${tripId}/documents`} className="text-3xs font-bold text-green hover:text-paper">
              Open document wallet →
            </Link>
          }
        >
          {flaggedDocuments.map(({ document, status }) => (
            <div key={document.id} className="flex items-center justify-between gap-2 rounded-md bg-ink px-3 py-2">
              <span className="truncate text-xs font-bold text-text">{document.title}</span>
              <span
                className="shrink-0 font-mono text-3xs font-bold"
                style={{ color: status.tone === 'expired' ? 'var(--color-line-4)' : 'var(--color-paper)' }}
              >
                {status.label}
              </span>
            </div>
          ))}
        </SectionCard>

        <SectionCard
          title="Packing"
          icon={Backpack}
          empty="No packing list yet."
          footer={
            <Link to={`/trips/${tripId}/packing`} className="text-3xs font-bold text-green hover:text-paper">
              Open packing list →
            </Link>
          }
        >
          {packingItems.length > 0 && (
            <div className="rounded-md bg-ink px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-text">
                <span>Packed</span>
                <span className="font-mono">
                  {packedCount} / {packingItems.length}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-green"
                  style={{ width: `${packingItems.length ? Math.round((packedCount / packingItems.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}
        </SectionCard>
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

function hasRenderableContent(node: React.ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasRenderableContent)
  return node !== false && node !== true && node !== null && node !== undefined && node !== ''
}

function SectionCard({
  title,
  icon: Icon,
  empty,
  footer,
  children,
}: {
  title: string
  icon: typeof MapPin
  empty: string
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const hasContent = hasRenderableContent(children)
  return (
    <section className="atlas-reveal mb-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.2em] text-text-dimmer">
          <Icon size={12} /> {title}
        </p>
        {footer}
      </div>
      {hasContent ? <div className="space-y-1.5">{children}</div> : <p className="text-xs text-text-dim">{empty}</p>}
    </section>
  )
}
