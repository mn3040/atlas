import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef } from 'react'
import { ArrowRight, Bike, Car, Pencil, Plane, Star, TrainFront, X, PersonStanding } from 'lucide-react'
import { actionForItem } from '../utils/itemActions'
import { iconForItem } from '../utils/categoryIcons'
import { estimateTravel, routeAvailability, TRAVEL_MODES } from '../utils/distance'
import type { LatLng, TravelMode } from '../utils/distance'
import { textColorForLine } from '../utils/lineColors'
import { formatTime } from '../utils/time'
import type { Item } from '../types/trip'

const MODE_ICONS: Record<TravelMode, typeof Car> = {
  walk: PersonStanding,
  bike: Bike,
  car: Car,
  train: TrainFront,
  flight: Plane,
}

export function ItemStation({
  item,
  nextItem,
  travelMode,
  number,
  color,
  isLast,
  selected,
  onSelect,
  onAction,
  onEdit,
  onDelete,
  onToggleMustSee,
  mapsUrl,
  bookingUrl,
  mustSee,
}: {
  item: Item
  nextItem?: Item
  travelMode: TravelMode
  number: number
  color: string
  isLast: boolean
  selected: boolean
  onSelect: (id: string) => void
  onAction: (item: Item) => void
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  onToggleMustSee: (id: string) => void
  mapsUrl: string
  bookingUrl: string
  mustSee: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const stationRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selected) return
    stationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const { label: actionLabel, action } = actionForItem(item)
  const ItemIcon = iconForItem(item.type, item.category)
  const commute = nextItem ? commuteBetween(item, nextItem, travelMode) : null
  const CommuteIcon = commute?.Icon

  return (
    <div
      ref={(node) => {
        stationRef.current = node
        setNodeRef(node)
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex gap-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-none flex-col items-center pt-0.5">
        <span
          className="z-[2] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
          style={{
            background: selected ? color : 'var(--color-surface-3)',
            borderColor: selected ? color : 'var(--color-ink)',
            color: selected ? textColorForLine(color) : 'var(--color-text)',
          }}
        >
          {number}
        </span>
        {!isLast && (
          <div
            className="mt-1 w-0.5 flex-1"
            style={{
              minHeight: commute ? '112px' : '76px',
              backgroundImage: `repeating-linear-gradient(0deg, ${color}55 0 4px, transparent 4px 8px)`,
            }}
          />
        )}
      </div>

      <div className="itinerary-station-body min-w-0 flex-1 pb-5">
        {item.startTime && (
          <p className="mb-1 text-[11px] font-semibold text-text-dimmer">
            {formatTime(item.startTime)}
            {item.type === 'flight' && item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
          </p>
        )}
        <div
          onClick={() => onSelect(item.id)}
          {...attributes}
          {...listeners}
          className="itinerary-card relative flex cursor-pointer gap-3 rounded-xl border p-2.5 transition-colors active:cursor-grabbing"
          style={{
            background: selected ? 'var(--color-surface-2)' : 'var(--color-surface)',
            borderColor: selected ? color : 'var(--color-border)',
          }}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-surface-3 text-xl">
            {item.photoUrl ? (
              <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <ItemIcon size={20} className="text-text-dim" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 truncate text-[13.5px] font-bold text-text">{item.name}</p>
            {item.locationLabel && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mb-0.5 block truncate text-[10.5px] text-text-dim hover:text-paper hover:underline"
              >
                {item.locationLabel.split(',')[0]} &rsaquo;
              </a>
            )}
            {item.priceLabel && <p className="mb-1.5 text-[10.5px] text-text-dim">{item.priceLabel}</p>}
            {action === 'maps' ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block rounded-md bg-surface-3 px-2.5 py-1.5 text-[10.5px] font-bold text-paper"
              >
                {actionLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAction(item)
                }}
                className="inline-block rounded-md bg-surface-3 px-2.5 py-1.5 text-[10.5px] font-bold text-paper"
              >
                {actionLabel}
              </button>
            )}
          </div>
          <div className="absolute right-1.5 top-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleMustSee(item.id)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-text-dim hover:text-paper"
              aria-label={mustSee ? `Unstar ${item.name}` : `Star ${item.name} as must-see`}
              title={mustSee ? 'Remove must-see' : 'Mark must-see'}
            >
              <Star size={11} fill={mustSee ? 'var(--color-paper)' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-text-dim hover:text-text"
              aria-label={`Edit ${item.name}`}
            >
              <Pencil size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item.id)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-text-dim hover:text-line-4"
              aria-label={`Remove ${item.name}`}
            >
              <X size={12} />
            </button>
          </div>
        </div>
        {commute && (
          <button
            type="button"
            onClick={() => onSelect(nextItem!.id)}
            className="mt-2 flex w-full items-center gap-2 rounded-md border border-border bg-ink/55 px-2.5 py-2 text-left text-[10.5px] text-text-dim transition-colors hover:border-border-strong hover:text-text"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ background: `${color}22`, color }}
            >
              {CommuteIcon && <CommuteIcon size={13} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-text">{commute.title}</span>
              <span className="block truncate">{commute.detail}</span>
            </span>
            <ArrowRight size={12} className="shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}

function commuteBetween(from: Item, to: Item, mode: TravelMode) {
  const origin = onwardPoint(from)
  const destination = onwardPoint(to)
  const availability = routeAvailability(origin, destination, mode)
  const modeLabel = TRAVEL_MODES.find((item) => item.id === mode)?.label ?? 'Route'
  const Icon = MODE_ICONS[mode]

  if (!availability.available) {
    return {
      Icon,
      title: `${modeLabel} not available`,
      detail: availability.reason ?? 'Choose another route mode.',
    }
  }

  const travel = estimateTravel(origin, destination, mode)
  const distance = travel.km >= 10 ? `${Math.round(travel.km)} km` : `${travel.km.toFixed(1)} km`
  return {
    Icon,
    title: `${travel.duration} ${modeLabel.toLowerCase()}`,
    detail: `${distance} to ${to.name}`,
  }
}

function onwardPoint(item: Item): LatLng {
  if (item.type === 'flight' && item.lat2 != null && item.lng2 != null) {
    return { lat: item.lat2, lng: item.lng2 }
  }
  return { lat: item.lat, lng: item.lng }
}
