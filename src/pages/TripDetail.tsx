import { useParams } from 'react-router-dom'

export default function TripDetail() {
  const { tripId } = useParams()

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Trip {tripId}
      </h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Map, timeline, and calendar views go here.
      </p>
    </div>
  )
}
