import { ArrowRight } from 'lucide-react'
import type { TravelMode } from '../utils/distance'
import { estimateTravel, routeAvailability, TRAVEL_MODES, TRAVEL_CTAS } from '../utils/distance'
import { textColorForLine } from '../utils/lineColors'
import type { Item } from '../types/trip'

const GOOGLE_TRAVELMODE: Partial<Record<TravelMode, string>> = {
  walk: 'walking',
  bike: 'bicycling',
  car: 'driving',
  train: 'transit',
}

function directionsUrl(from: Item, to: Item, mode: TravelMode): string {
  const origin = directionsLabel(from, from.type === 'flight')
  const destination = directionsLabel(to, false)
  if (mode === 'flight') {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(from.name)}%20to%20${encodeURIComponent(to.name)}`
  }
  const travelmode = GOOGLE_TRAVELMODE[mode] ?? 'driving'
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${travelmode}`
}

function onwardPoint(item: Item) {
  if (item.type === 'flight' && item.lat2 != null && item.lng2 != null) {
    return { lat: item.lat2, lng: item.lng2 }
  }
  return { lat: item.lat, lng: item.lng }
}

function directionsLabel(item: Item, useArrival: boolean): string {
  const label = useArrival ? item.location2Label : item.locationLabel
  const coords = useArrival && item.lat2 != null && item.lng2 != null ? `${item.lat2},${item.lng2}` : `${item.lat},${item.lng}`
  return [item.name, label].filter(Boolean).join(', ') || coords
}

export function TransitCard({
  from,
  to,
  mode,
  color,
}: {
  from: Item
  to: Item
  mode: TravelMode
  color: string
}) {
  const origin = onwardPoint(from)
  const destination = onwardPoint(to)
  const availability = routeAvailability(origin, destination, mode)
  const travel = availability.available ? estimateTravel(origin, destination, mode) : null
  const modeLabel = TRAVEL_MODES.find((m) => m.id === mode)!.label

  return (
    <div className="absolute bottom-16 right-4 z-10 hidden w-[230px] rounded-2xl border border-border-strong bg-surface p-3.5 shadow-[var(--shadow-overlay)] md:block">
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg"
          style={{ background: color }}
        >
          <ArrowRight size={13} style={{ color: textColorForLine(color) }} />
        </div>
        <div>
          <p className="text-[10px] text-text-dim">{modeLabel} Route</p>
          <p className="text-sm font-extrabold leading-none text-text">{travel?.duration ?? 'Not available'}</p>
        </div>
      </div>
      <p className="mb-2.5 text-[10.5px] leading-snug text-text-dim">{travel?.note ?? availability.reason}</p>
      {availability.available ? (
        <a
          href={directionsUrl(from, to, mode)}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md py-2 text-center text-[11.5px] font-bold text-white"
          style={{ background: color, color: textColorForLine(color) }}
        >
          {TRAVEL_CTAS[mode]}
        </a>
      ) : (
        <div className="block rounded-md border border-border-strong py-2 text-center text-[11.5px] font-bold text-text-dim">
          Not available
        </div>
      )}
    </div>
  )
}
