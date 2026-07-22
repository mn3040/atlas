import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { fetchTrips, createTrip } from '../api/trips'
import { TopNav } from '../components/TopNav'
import { lineColorForIndex } from '../utils/lineColors'
import { flagEmoji } from '../utils/flags'
import type { Trip } from '../types/trip'

const inputClass =
  'mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-paper focus:outline-none'

export default function Dashboard() {
  const { session } = useSession()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

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
    const trip = await createTrip({ ...input, ownerId: session.user.id })
    setTrips((current) => [...current, trip].sort((a, b) => a.startDate.localeCompare(b.startDate)))
    setShowForm(false)
  }

  return (
    <div className="flex h-screen flex-col bg-ink">
      <TopNav />

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-12">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight text-text">Your trips</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim"
          >
            <Plus size={15} /> {showForm ? 'Cancel' : 'New trip'}
          </button>
        </div>

        {showForm && <NewTripForm onCreate={handleCreate} />}

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
                  <Link
                    to={`/trips/${trip.id}`}
                    className="group flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: lineColorForIndex(index) }}
                      />
                      <span className="truncate text-base font-bold text-text group-hover:text-paper">
                        {trip.name}
                      </span>
                    </div>
                    {trip.description && (
                      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-text-dim">{trip.description}</p>
                    )}
                    <div className="mt-auto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                      <MapPin size={11} />
                      {trip.startDate} &ndash; {trip.endDate}
                      {flagEmoji(trip.countryCode) && <span className="normal-case">{flagEmoji(trip.countryCode)}</span>}
                    </div>
                  </Link>
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
}: {
  onCreate: (input: {
    name: string
    description: string
    countryCode: string
    startDate: string
    endDate: string
  }) => void
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
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-dim">
            Country {flagEmoji(countryCode)}
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
      <button
        type="submit"
        className="rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim"
      >
        Create trip
      </button>
    </form>
  )
}
