import { useEffect, useState } from 'react'
import { CloudSun, Loader2, Umbrella, Wind } from 'lucide-react'
import { fetchWeatherForPoint } from '../api/weather'
import type { WeatherSummary } from '../api/weather'
import type { Item } from '../types/trip'

export function WeatherChip({
  item,
  date,
  compact = false,
}: {
  item: Item | undefined
  date: string | undefined
  /** Use inside short map previews (e.g. the dashboard's map card) that have
   * no in-map header bar to clear -- the default top-14 offset is tuned for
   * the full-screen itinerary map and overlaps badly in a ~190px-tall box. */
  compact?: boolean
}) {
  const [weather, setWeather] = useState<WeatherSummary | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const itemId = item?.id
  const itemLat = item?.lat
  const itemLng = item?.lng

  useEffect(() => {
    if (!itemId || itemLat == null || itemLng == null || !date) {
      setWeather(null)
      setError('')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchWeatherForPoint({ lat: itemLat, lng: itemLng, date, signal: controller.signal })
      .then(setWeather)
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : 'Weather unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [date, itemId, itemLat, itemLng])

  if (!item || !date) return null

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className={`absolute z-10 max-w-[calc(100vw-7rem)] rounded-[10px] border border-border-strong bg-surface/92 px-3 py-2 text-left text-text shadow-lg backdrop-blur-sm transition-all hover:border-paper ${
        compact ? 'left-2 top-2' : 'left-4 top-14 md:top-16'
      }`}
      aria-label="Weather forecast"
    >
      <span className="flex items-center gap-2">
        {loading ? <Loader2 size={14} className="animate-spin text-paper" /> : <CloudSun size={15} className="text-paper" />}
        <span className="text-[11px] font-extrabold uppercase tracking-wide">
          {weather ? `${weather.tempHighF} / ${weather.tempLowF}F` : error ? 'Weather off' : 'Weather'}
        </span>
      </span>
      {expanded && (
        <span className="mt-2 block min-w-[190px] text-[10.5px] leading-relaxed text-text-dim">
          {weather ? (
            <>
              <span className="block font-bold text-text">{weather.label} near {item.name}</span>
              <span className="mt-1 flex items-center gap-2">
                <Umbrella size={12} /> {weather.precipitationMm} mm
                <Wind size={12} /> {weather.windKmh} km/h
              </span>
              {weather.isDateFallback && <span className="mt-1 block">Forecast shown for {formatShortDate(weather.date)}.</span>}
            </>
          ) : (
            <span>{error || 'Loading forecast...'}</span>
          )}
        </span>
      )}
    </button>
  )
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
