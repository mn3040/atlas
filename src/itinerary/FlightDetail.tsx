import { ChevronLeft, Plane } from 'lucide-react'
import { formatTime } from '../utils/time'
import type { Item } from '../types/trip'

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function airportName(label: string | null): string {
  return label ? label.split(',')[0] : '—'
}

function flightDuration(
  startTime: string | null,
  endTime: string | null,
  startDate: string,
  endDate: string | null,
): string | null {
  if (!startTime || !endTime) return null
  const start = new Date(`${startDate}T${startTime}`)
  const end = new Date(`${endDate ?? startDate}T${endTime}`)
  let minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  if (minutes < 0) minutes += 24 * 60
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function FlightDetail({
  item,
  onBack,
  onModify,
  onCancel,
}: {
  item: Item
  onBack: () => void
  onModify: () => void
  onCancel: () => void
}) {
  const duration = flightDuration(item.startTime, item.endTime, item.startDate, item.endDate)

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-text-dim hover:text-text"
      >
        <ChevronLeft size={14} /> Flight Detail
      </button>

      <div className="mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-5xl">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.flightNumber ?? 'Flight'} className="h-full w-full object-cover" />
        ) : (
          <span>✈️</span>
        )}
      </div>

      <h2 className="mb-1 text-lg font-extrabold text-text">{item.flightNumber || 'Flight'}</h2>
      <p className="mb-5 text-xs text-text-dim">{formatDate(item.startDate)}</p>

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-4">
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-extrabold text-text">{formatTime(item.startTime) || '—'}</p>
          <p className="mt-1 truncate text-[11px] text-text-dim">{airportName(item.locationLabel)}</p>
        </div>
        <div className="flex flex-1 flex-col items-center px-2">
          <Plane size={14} className="mb-1 text-text-dim" />
          <div className="h-px w-full bg-border" />
          {duration && <p className="mt-1 text-[10px] whitespace-nowrap text-text-dimmer">{duration}</p>}
        </div>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-extrabold text-text">{formatTime(item.endTime) || '—'}</p>
          <p className="mt-1 truncate text-[11px] text-text-dim">{airportName(item.location2Label)}</p>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
        <span className="text-[10px] text-text-dim">Price</span>
        <span className="text-xs font-bold text-text">{item.priceLabel || '—'}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={onModify}
          className="rounded-lg bg-paper py-3 text-center text-sm font-bold text-ink hover:bg-paper-dim"
        >
          Modify Flight
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border-strong py-2.5 text-center text-sm font-bold text-text hover:border-text-dim"
        >
          Cancel Flight
        </button>
      </div>
    </div>
  )
}
