import { PersonStanding, Bike, Car, TrainFront, Plane } from 'lucide-react'
import type { TravelMode } from '../utils/distance'

const MODE_ICONS: Record<TravelMode, typeof Car> = {
  walk: PersonStanding,
  bike: Bike,
  car: Car,
  train: TrainFront,
  flight: Plane,
}

export function TravelModePicker({
  mode,
  onChange,
}: {
  mode: TravelMode
  onChange: (mode: TravelMode) => void
}) {
  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
      {(Object.keys(MODE_ICONS) as TravelMode[]).map((id) => {
        const Icon = MODE_ICONS[id]
        const active = mode === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-label={id}
            className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              active
                ? 'border-transparent bg-paper text-ink'
                : 'border-border bg-surface/90 text-text-dim backdrop-blur hover:text-text'
            }`}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
