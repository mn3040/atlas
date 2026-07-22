import { ChevronLeft } from 'lucide-react'
import { formatTime } from '../utils/time'
import type { Item } from '../types/trip'

function nightsBetween(start: string, end: string | null): number {
  if (!end) return 1
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function displayName(name: string): string {
  return name.replace(/\s*\(Check-in\)\s*$/i, '').replace(/\s*\(Check-out\)\s*$/i, '')
}

export function BookingDetail({
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
  const nights = nightsBetween(item.startDate, item.endDate)
  const rate = item.nightlyRate ?? 0
  const taxes = item.taxesFees ?? 0
  const roomTotal = rate * nights
  const total = roomTotal + taxes
  const rating = item.rating ?? 0

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-text-dim hover:text-text"
      >
        <ChevronLeft size={14} /> Booking Detail
      </button>

      <div className="mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-5xl">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span>🏨</span>
        )}
      </div>

      <h2 className="mb-1.5 text-lg font-extrabold text-text">{displayName(item.name)}</h2>
      <div className="mb-2 flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: i < rating ? 'var(--color-paper)' : 'var(--color-border-strong)' }}
          />
        ))}
      </div>
      <p className="mb-1 text-xs text-text-dim">{item.locationLabel}</p>
      {item.googleMapsUrl && (
        <a
          href={item.googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-5 inline-block text-xs font-semibold text-paper hover:underline"
        >
          View on Google Maps &rsaquo;
        </a>
      )}
      {!item.googleMapsUrl && <div className="mb-5" />}

      <div className="mb-4 flex rounded-xl border border-border py-3">
        <div className="flex-1 text-center">
          <p className="mb-1 text-[10px] text-text-dimmer">Check-in</p>
          <p className="text-xs font-bold text-text">
            {formatDate(item.startDate)}
            {item.startTime ? `, ${formatTime(item.startTime)}` : ''}
          </p>
        </div>
        <div className="w-px bg-border" />
        <div className="flex-1 text-center">
          <p className="mb-1 text-[10px] text-text-dimmer">Check-out</p>
          <p className="text-xs font-bold text-text">
            {item.endDate ? formatDate(item.endDate) : '—'}
            {item.endTime ? `, ${formatTime(item.endTime)}` : ''}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-surface px-3.5 py-3">
        <p className="mb-1 text-sm font-bold text-text">{item.roomType || 'Standard Room'}</p>
        <p className="text-xs text-text-dim">
          {item.guests ?? 1} Guest{(item.guests ?? 1) === 1 ? '' : 's'} &middot; {nights} Night
          {nights === 1 ? '' : 's'}
        </p>
      </div>

      <p className="mb-2 text-xs font-bold text-text-dim">Price Breakdown</p>
      <div className="mb-1.5 flex justify-between text-xs text-text">
        <span>
          Room rate &times; {nights} night{nights === 1 ? '' : 's'}
        </span>
        <span>${roomTotal.toFixed(2)}</span>
      </div>
      <div className="mb-2.5 flex justify-between text-xs text-text">
        <span>Taxes &amp; fees</span>
        <span>${taxes.toFixed(2)}</span>
      </div>
      <div className="mb-4 flex justify-between border-t border-border pt-2.5 text-sm font-extrabold text-text">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
        <span className="text-[10px] text-text-dim">Confirmation No.</span>
        <span className="text-xs font-bold tracking-wide text-text">{item.confirmationNumber || '—'}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={onModify}
          className="rounded-lg bg-paper py-3 text-center text-sm font-bold text-ink hover:bg-paper-dim"
        >
          Modify Booking
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border-strong py-2.5 text-center text-sm font-bold text-text hover:border-text-dim"
        >
          Cancel Booking
        </button>
      </div>
    </div>
  )
}
