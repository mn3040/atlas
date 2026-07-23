import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Trash2, Wand2 } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { fetchTrips, createTrip, deleteTrip } from '../api/trips'
import { TopNav } from '../components/TopNav'
import { CountryFlag } from '../components/CountryFlag'
import { lineColorForIndex } from '../utils/lineColors'
import { createSampleTrips } from '../utils/sampleTrips'
import { shouldConfirmBeforeDelete } from '../utils/settings'
import type { Trip } from '../types/trip'

const inputClass =
  'mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-paper focus:outline-none'

export default function Dashboard() {
  const { session } = useSession()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  const [addingSamples, setAddingSamples] = useState(false)

  useEffect(() => {
    fetchTrips()
      .then(setTrips)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(input: {
    name: string
    description: string
    countryCode: string
    startDate: string
    endDate: string
  }) {
    if (!session) return
    setCreateError(null)
    try {
      const trip = await createTrip({ ...input, ownerId: session.user.id })
      setTrips((current) => [...current, trip].sort((a, b) => a.startDate.localeCompare(b.startDate)))
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
    setTrips((current) => current.filter((item) => item.id !== trip.id))
    try {
      await deleteTrip(trip.id)
    } catch (err) {
      setTrips(previousTrips)
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
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create sample trips.')
    } finally {
      setAddingSamples(false)
    }
  }

  return (
    <div className="atlas-dashboard flex h-screen flex-col bg-ink">
      <TopNav />

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-12">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-paper">Atlas archive</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-text">Your trips</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={handleAddSamples}
              disabled={!session || addingSamples}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-bold text-text hover:border-green hover:text-green disabled:cursor-wait disabled:opacity-50"
            >
              <Wand2 size={15} /> {addingSamples ? 'Adding...' : 'Add sample trips'}
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim"
            >
              <Plus size={15} /> {showForm ? 'Cancel' : 'New trip'}
            </button>
          </div>
        </div>

        {showForm && <NewTripForm onCreate={handleCreate} error={createError} />}
        {deleteError && (
          <p className="mt-4 border-l-4 border-line-3 bg-surface px-3 py-2 text-sm font-semibold text-text">
            {deleteError}
          </p>
        )}

        <div className="mt-8">
          {loading ? (
            <p className="py-6 text-sm text-text-dim">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-text-dim">
              No trips yet — build your first itinerary.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {trips.map((trip, index) => (
                <li key={trip.id}>
                  <article className="group relative min-h-[158px] overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
                    <Link to={`/trips/${trip.id}`} className="flex h-full flex-col p-4 pr-12">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          className="h-8 w-1 shrink-0"
                          style={{ background: lineColorForIndex(index) }}
                        />
                        <span className="truncate text-lg font-extrabold text-text group-hover:text-paper">
                          {trip.name}
                        </span>
                      </div>
                      {trip.description && (
                        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-text-dim">{trip.description}</p>
                      )}
                      <div className="mt-auto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                        <MapPin size={11} />
                        {trip.startDate} &ndash; {trip.endDate}
                        <CountryFlag countryCode={trip.countryCode} className="h-3 w-auto rounded-[1px]" />
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteTrip(trip)}
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
    startDate: string
    endDate: string
  }) => void
  error: string | null
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onCreate({ name, description, countryCode, startDate, endDate })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Trip name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kazakhstan Explorer"
            className={inputClass}
          />
        </div>
        <div className="w-28">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Country <CountryFlag countryCode={countryCode} className="h-3 w-auto rounded-[1px]" />
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
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">Start date</label>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
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
