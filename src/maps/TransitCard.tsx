import { ArrowRight } from 'lucide-react'
import type { TravelMode } from '../utils/distance'
import { estimateTravel, TRAVEL_MODES } from '../utils/distance'
import type { Item } from '../types/trip'

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
    <div className="absolute bottom-4 right-4 z-10 w-56 rounded-lg border border-border bg-surface/95 p-3.5 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: color }}
        >
          <ArrowRight size={15} className="text-ink" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-dim">
            {modeLabel} to next stop
          </p>
          <p className="font-display text-lg font-semibold leading-none text-text">
            {travel.duration}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-snug text-text-dim">{travel.note}</p>
      <p className="mt-2 truncate text-xs text-text-dim">
        <span className="text-text">{from.name}</span> → <span className="text-text">{to.name}</span>
      </p>
    </div>
  )
}
