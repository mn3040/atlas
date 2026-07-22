import { ArrowRight } from 'lucide-react'
import type { TravelMode } from '../utils/distance'
import { estimateTravel, TRAVEL_MODES, TRAVEL_CTAS } from '../utils/distance'
import type { Item } from '../types/trip'

const GOOGLE_TRAVELMODE: Partial<Record<TravelMode, string>> = {
  walk: 'walking',
  bike: 'bicycling',
  car: 'driving',
  train: 'transit',
}

function directionsUrl(from: Item, to: Item, mode: TravelMode): string {
  if (mode === 'flight') {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(from.name)}%20to%20${encodeURIComponent(to.name)}`
  }
  const travelmode = GOOGLE_TRAVELMODE[mode] ?? 'driving'
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${travelmode}`
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
  const travel = estimateTravel(from, to, mode)
  const modeLabel = TRAVEL_MODES.find((m) => m.id === mode)!.label

  return (
    <div className="absolute bottom-16 right-4 z-10 w-[230px] rounded-2xl border border-border-strong bg-surface p-3.5 shadow-2xl">
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg"
          style={{ background: color }}
        >
          <ArrowRight size={13} className="text-white" />
        </div>
        <div>
          <p className="text-[10px] text-text-dim">{modeLabel} Route</p>
          <p className="text-sm font-extrabold leading-none text-text">{travel.duration}</p>
        </div>
      </div>
      <p className="mb-2.5 text-[10.5px] leading-snug text-text-dim">{travel.note}</p>
      <a
        href={directionsUrl(from, to, mode)}
        target="_blank"
        rel="noreferrer"
        className="block rounded-md py-2 text-center text-[11.5px] font-bold text-white"
        style={{ background: color }}
      >
        {TRAVEL_CTAS[mode]}
      </a>
    </div>
  )
}
