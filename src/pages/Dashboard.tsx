import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileUp, Plus, MapPin, Trash2, Wand2, Users, UserRound, Archive } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { fetchTrips, createTrip, deleteTrip, fetchItems } from '../api/trips'
import { TopNav } from '../components/TopNav'
import { CountryFlag, CountryFlags } from '../components/CountryFlag'
import { lineColorForIndex } from '../utils/lineColors'
import { createSampleTrips } from '../utils/sampleTrips'
import { shouldConfirmBeforeDelete } from '../utils/settings'
import { countryCodesForTrip } from '../utils/flags'
import { DashboardImportModal } from './DashboardImportModal'
import type { Item, Trip, TripVisibility } from '../types/trip'

const inputClass =
  'mt-1 min-h-11 w-full rounded-md border border-border bg-ink px-3 py-2 text-base text-text placeholder:text-text-dim focus:border-paper focus:outline-none sm:text-sm'

function normalizeMemberLimit(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(99, Math.max(1, Math.round(parsed)))
}

export default function Dashboard() {
  const { session } = useSession()
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripItems, setTripItems] = useState<Record<string, Item[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  const [addingSamples, setAddingSamples] = useState(false)
  const activeTrips = trips.filter((trip) => !trip.archivedAt)
  const personalTrips = activeTrips.filter((trip) => trip.visibility !== 'group')
  const groupTrips = activeTrips.filter((trip) => trip.visibility === 'group')
  const archivedTrips = trips.filter((trip) => trip.archivedAt)

  useEffect(() => {
    fetchTrips()
      .then(async (tripData) => {
        setTrips(tripData)
        const entries = await Promise.all(tripData.map(async (trip) => [trip.id, await fetchItems(trip.id)] as const))
        setTripItems(Object.fromEntries(entries))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(input: {
    name: string
    description: string
    countryCode: string
    visibility: TripVisibility
    memberLimit: number | null
    startDate: string
    endDate: string
  }) {
    if (!session) return
    setCreateError(null)
    try {
      const trip = await createTrip({ ...input, ownerId: session.user.id })
      setTrips((current) => [...current, trip].sort((a, b) => a.startDate.localeCompare(b.startDate)))
      setTripItems((current) => ({ ...current, [trip.id]: [] }))
      setShowForm(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create trip.')
    }
  }

  async function handleDeleteTrip(trip: Trip) {
    if (shouldConfirmBeforeDelete() && !confirm(`Delete "${trip.name}"? This removes the whole trip and everything in it.`)) return
    setDeleteError(null)
    setDeletingTripId(trip.id)
    const previousTrips = trips
    const previousTripItems = tripItems
    setTrips((current) => current.filter((item) => item.id !== trip.id))
    setTripItems((current) => {
      const next = { ...current }
      delete next[trip.id]
      return next
    })
    try {
      await deleteTrip(trip.id)
    } catch (err) {
      setTrips(previousTrips)
      setTripItems(previousTripItems)
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete trip.')
    } finally {
      setDeletingTripId(null)
    }
  }

  async function handleAddSamples() {
    if (!session) return
    setCreateError(null)
    setAddingSamples(true)
    try {
      const createdTrips = await createSampleTrips(
        session.user.id,
        trips.map((trip) => trip.name),
      )
      setTrips((current) => [...current, ...createdTrips].sort((a, b) => a.startDate.localeCompare(b.startDate)))
      const entries = await Promise.all(createdTrips.map(async (trip) => [trip.id, await fetchItems(trip.id)] as const))
      setTripItems((current) => ({ ...current, ...Object.fromEntries(entries) }))
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create sample trips.')
    } finally {
      setAddingSamples(false)
    }
  }

  return (
    <div className="atlas-dashboard flex h-screen flex-col bg-ink">
      <TopNav />

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="atlas-reveal relative mb-6 overflow-hidden rounded-lg border border-border-strong bg-surface/74 p-5 shadow-2xl backdrop-blur-md sm:p-7">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,221,133,0.13),transparent_35%),linear-gradient(315deg,rgba(247,255,136,0.11),transparent_32%)]" />
            <div className="absolute right-8 top-6 hidden h-28 w-28 rounded-full border border-green/20 bg-surface-3/35 sm:block atlas-float" />
          </div>
          <div className="relative z-[1] flex flex-col gap-5">
            <div className="max-w-xl">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-paper">Atlas planboard</p>
              <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">Your trips</h1>
              <p className="mt-3 text-sm leading-relaxed text-text-dim">
                Build cinematic routes, import rough plans, vote with your group, and lock the day when the route finally feels right.
              </p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide text-text-dim">
                <span className="rounded-full bg-ink/70 px-2.5 py-1">{activeTrips.length} active</span>
                <span className="rounded-full bg-ink/70 px-2.5 py-1">{groupTrips.length} group</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  onClick={() => setShowImport(true)}
                  disabled={!session}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-ink/70 px-4 py-2 text-sm font-bold text-text hover:border-paper hover:text-paper disabled:opacity-50"
                >
                  <FileUp size={15} /> Import
                </button>
                <button
                  onClick={handleAddSamples}
                  disabled={!session || addingSamples}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-ink/70 px-4 py-2 text-sm font-bold text-text hover:border-green hover:text-green disabled:cursor-wait disabled:opacity-50"
                >
                  <Wand2 size={15} /> {addingSamples ? 'Adding...' : 'Samples'}
                </button>
                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim"
                >
                  <Plus size={15} /> {showForm ? 'Cancel' : 'New trip'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showImport && session && <DashboardImportModal ownerId={session.user.id} onClose={() => setShowImport(false)} />}
        {showForm && <NewTripForm onCreate={handleCreate} error={createError} />}
        {deleteError && (
          <p className="mt-4 border-l-4 border-line-3 bg-surface px-3 py-2 text-sm font-semibold text-text">
            {deleteError}
          </p>
        )}

        <div className="atlas-reveal atlas-reveal-delay-2 mt-8">
          {loading ? (
            <p className="py-6 text-sm text-text-dim">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-text-dim">
              No trips yet — build your first itinerary.
            </p>
          ) : (
            <div className="space-y-8">
              <TripSection
                title="Personal trips"
                icon={UserRound}
                trips={personalTrips}
                tripItems={tripItems}
                deletingTripId={deletingTripId}
                onDelete={handleDeleteTrip}
              />
              <TripSection
                title="Group trips"
                icon={Users}
                trips={groupTrips}
                tripItems={tripItems}
                deletingTripId={deletingTripId}
                onDelete={handleDeleteTrip}
              />
              {archivedTrips.length > 0 && (
                <TripSection
                  title="Archived"
                  icon={Archive}
                  trips={archivedTrips}
                  tripItems={tripItems}
                  deletingTripId={deletingTripId}
                  onDelete={handleDeleteTrip}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NewTripForm({
  onCreate,
  error,
}: {
  onCreate: (input: {
    name: string
    description: string
    countryCode: string
    visibility: TripVisibility
    memberLimit: number | null
    startDate: string
    endDate: string
  }) => void
  error: string | null
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [visibility, setVisibility] = useState<TripVisibility>('personal')
  const [memberLimit, setMemberLimit] = useState('4')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onCreate({
      name,
      description,
      countryCode,
      visibility,
      memberLimit: visibility === 'group' ? normalizeMemberLimit(memberLimit) : null,
      startDate,
      endDate,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
        <div className="min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Trip name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kazakhstan Explorer"
            className={inputClass}
          />
        </div>
        <div className="min-w-0">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Primary country <CountryFlag countryCode={countryCode} className="h-3 w-auto rounded-[1px]" />
          </label>
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.slice(0, 2))}
            placeholder="KZ"
            maxLength={2}
            className={`${inputClass} uppercase`}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">
          Description <span className="normal-case text-text-dimmer">(optional)</span>
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="From the Tien Shan foothills to the futurist skyline of Astana…"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Trip mode</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <ModeButton active={visibility === 'personal'} icon={UserRound} label="Personal" onClick={() => setVisibility('personal')} />
            <ModeButton active={visibility === 'group'} icon={Users} label="Group" onClick={() => setVisibility('group')} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Travelers</label>
          <input
            type="number"
            min={1}
            max={99}
            inputMode="numeric"
            disabled={visibility !== 'group'}
            value={memberLimit}
            onChange={(e) => setMemberLimit(e.target.value)}
            onBlur={() => setMemberLimit((value) => normalizeMemberLimit(value)?.toString() ?? '1')}
            className={`${inputClass} disabled:opacity-45`}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Start date</label>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">End date</label>
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        className="rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim"
      >
        Create trip
      </button>
    </form>
  )
}

function TripSection({
  title,
  icon: Icon,
  trips,
  tripItems,
  deletingTripId,
  onDelete,
}: {
  title: string
  icon: typeof Users
  trips: Trip[]
  tripItems: Record<string, Item[]>
  deletingTripId: string | null
  onDelete: (trip: Trip) => void
}) {
  if (trips.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-text-dim">
        <Icon size={14} /> {title}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {trips.map((trip, index) => (
          <li key={trip.id}>
            <article className="atlas-cinematic-card group relative min-h-[164px] overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
              <Link to={`/trips/${trip.id}`} className="flex h-full flex-col p-4 pr-12">
                <div className="mb-4 flex items-center gap-3">
                  <span className="route-shimmer h-8 w-1 shrink-0" style={{ background: `linear-gradient(180deg, ${lineColorForIndex(index)}, var(--color-paper), ${lineColorForIndex(index)})` }} />
                  <span className="truncate text-lg font-extrabold text-text group-hover:text-paper">{trip.name}</span>
                </div>
                {trip.description && (
                  <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-text-dim">{trip.description}</p>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-text-dim">
                    {trip.visibility === 'group' ? <Users size={11} /> : <UserRound size={11} />}
                    {trip.visibility === 'group' ? `Group${trip.memberLimit ? ` / ${trip.memberLimit}` : ''}` : 'Personal'}
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                  <MapPin size={11} />
                  {trip.startDate} &ndash; {trip.endDate}
                  <CountryFlags
                    countryCodes={countryCodesForTrip(trip, tripItems[trip.id] ?? [])}
                    className="h-3 w-auto rounded-[1px]"
                  />
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onDelete(trip)}
                disabled={deletingTripId === trip.id}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-ink text-text-dim transition-colors hover:border-line-3 hover:text-line-3 disabled:cursor-wait disabled:opacity-50"
                aria-label={`Delete ${trip.name}`}
                title="Delete trip"
              >
                <Trash2 size={14} />
              </button>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Users
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold"
      style={{
        borderColor: active ? 'var(--color-green)' : 'var(--color-border)',
        background: active ? 'rgba(34, 221, 133, 0.14)' : 'var(--color-ink)',
        color: active ? 'var(--color-green)' : 'var(--color-text-dim)',
      }}
    >
      <Icon size={14} /> {label}
    </button>
  )
}
