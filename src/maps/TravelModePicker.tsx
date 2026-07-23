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
  color,
}: {
  mode: TravelMode
  onChange: (mode: TravelMode) => void
  color: string
}) {
  return (
    <div className="absolute right-3 top-24 z-10 flex flex-col gap-2 md:right-4 md:top-4">
      {(Object.keys(MODE_ICONS) as TravelMode[]).map((id) => {
        const Icon = MODE_ICONS[id]
        const active = mode === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-label={id}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border-strong transition-colors"
            style={{ background: active ? color : 'var(--color-surface)', color: active ? '#fff' : 'var(--color-text-dim)' }}
          >
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}
