import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { joinTripByToken } from '../api/groupTrips'
import { TopNav } from '../components/TopNav'

export default function JoinTrip() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invite link is missing a token.')
      return
    }

    let cancelled = false
    joinTripByToken(token)
      .then((tripId) => {
        if (!cancelled) navigate(`/trips/${tripId}`, { replace: true })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join this trip.')
      })

    return () => {
      cancelled = true
    }
  }, [navigate, token])

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <TopNav />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4">
        <section className="w-full rounded-lg border border-border bg-surface p-5 text-center">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Atlas invite</p>
          <h1 className="text-xl font-extrabold text-text">{error ? 'Invite needs attention' : 'Joining trip...'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            {error ?? 'Adding this traveler profile to the group itinerary.'}
          </p>
          {error && (
            <Link to="/" className="mt-5 inline-flex rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink">
              Back to trips
            </Link>
          )}
        </section>
      </main>
    </div>
  )
}
