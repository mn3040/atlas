import { Link } from 'react-router-dom'
import { useTripStore } from '../hooks/useTripStore'

export default function Dashboard() {
  const trips = useTripStore((state) => state.trips)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Your trips
      </h1>

      {trips.length === 0 ? (
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          No trips yet. Once Supabase is connected, trips you create will show up here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                to={`/trips/${trip.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {trip.name}
                </span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  {trip.startDate} – {trip.endDate}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
