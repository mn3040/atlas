import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { fetchTrips, createTrip } from '../api/trips'
import type { Trip } from '../types/trip'

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

  async function handleCreate(input: { name: string; startDate: string; endDate: string }) {
    if (!session) return
    const trip = await createTrip({ ...input, ownerId: session.user.id })
    setTrips((current) => [...current, trip].sort((a, b) => a.startDate.localeCompare(b.startDate)))
    setShowForm(false)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-text">
          Your trips
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
        >
          {showForm ? 'Cancel' : 'New trip'}
        </button>
      </div>

      {showForm && <NewTripForm onCreate={handleCreate} />}

      <div className="mt-8 border-t border-border">
        {loading ? (
          <p className="py-6 font-mono text-sm text-text-dim">Loading…</p>
        ) : trips.length === 0 ? (
          <p className="py-6 text-text-dim">
            No trips yet — build your first line.
          </p>
        ) : (
          <ul>
            {trips.map((trip) => (
              <li key={trip.id} className="border-b border-border">
                <Link
                  to={`/trips/${trip.id}`}
                  className="flex items-center justify-between py-4 hover:text-line-2"
                >
                  <span className="font-display text-2xl">{trip.name}</span>
                  <span className="font-mono text-xs uppercase tracking-wide text-text-dim">
                    {trip.startDate} — {trip.endDate}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function NewTripForm({
  onCreate,
}: {
  onCreate: (input: { name: string; startDate: string; endDate: string }) => void
}) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onCreate({ name, startDate, endDate })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-md border border-border bg-surface p-5">
      <div>
        <label className="block font-mono text-xs uppercase tracking-wide text-text-dim">Trip name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Japan 2027"
          className="mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block font-mono text-xs uppercase tracking-wide text-text-dim">Start date</label>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-text focus:border-line-2 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block font-mono text-xs uppercase tracking-wide text-text-dim">End date</label>
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-ink px-3 py-2 text-text focus:border-line-2 focus:outline-none"
          />
        </div>
      </div>
      <button
        type="submit"
        className="rounded-md bg-line-2 px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
      >
        Create trip
      </button>
    </form>
  )
}
