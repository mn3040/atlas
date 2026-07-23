import { ChevronLeft, ExternalLink, Plane } from 'lucide-react'
import { formatTime } from '../utils/time'
import { bookingUrlForItem } from '../utils/itemActions'
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

/** Deterministic bar-width sequence seeded by the flight number/id so the
 * same flight always draws the same "barcode" instead of reshuffling on
 * every render. Purely decorative -- ticket stub flourish, not a real code. */
function barcodeWidths(seed: string): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const widths: number[] = []
  for (let i = 0; i < 28; i += 1) {
    hash = (hash * 1103515245 + 12345) >>> 0
    widths.push(1 + (hash % 3))
  }
  return widths
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
  const bookingUrl = bookingUrlForItem(item)

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
          <Plane size={42} className="text-text-dim" />
        )}
      </div>

      <h2 className="mb-1 text-lg font-extrabold text-text">{item.flightNumber || 'Flight'}</h2>
      <p className="mb-5 text-xs text-text-dim">{formatDate(item.startDate)}</p>

      {/* Boarding-pass treatment: header stub, route/time, a perforated tear
          line with punched notches, and a barcode footer -- all decorative,
          built from data already on the item (no new fields needed). */}
      <div className="mb-5 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3.5 py-2">
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-text-dim">Boarding Pass</span>
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-paper">
            {item.flightNumber || 'Flight'}
          </span>
        </div>

        <div className="flex items-center gap-3 px-3.5 py-4">
          <div className="min-w-0 flex-1 text-center">
            <p className="text-lg font-extrabold text-green">{formatTime(item.startTime) || '—'}</p>
            <p className="mt-1 truncate text-[11px] text-text-dim">{airportName(item.locationLabel)}</p>
          </div>
          <div className="flex flex-1 flex-col items-center px-2">
            <Plane size={14} className="mb-1 text-text-dim" />
            <div className="h-px w-full bg-border" />
            {duration && <p className="mt-1 text-[10px] whitespace-nowrap text-text-dimmer">{duration}</p>}
          </div>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-lg font-extrabold text-green">{formatTime(item.endTime) || '—'}</p>
            <p className="mt-1 truncate text-[11px] text-text-dim">{airportName(item.location2Label)}</p>
          </div>
        </div>

        <div className="relative border-t border-dashed border-border-strong" aria-hidden="true">
          <span className="absolute -top-[9px] -left-[9px] h-[18px] w-[18px] rounded-full bg-ink" />
          <span className="absolute -top-[9px] -right-[9px] h-[18px] w-[18px] rounded-full bg-ink" />
        </div>

        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="flex h-6 items-end gap-[1.5px]" aria-hidden="true">
            {barcodeWidths(item.flightNumber || item.id).map((w, i) => (
              <span
                key={i}
                className="bg-text-dimmer"
                style={{ width: w, height: i % 5 === 0 ? '100%' : '65%' }}
              />
            ))}
          </div>
          <span className="shrink-0 text-xs font-bold text-text">{item.priceLabel || '—'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-paper py-3 text-center text-sm font-bold text-ink hover:bg-paper-dim"
        >
          Find booking options <ExternalLink size={14} />
        </a>
        <button
          onClick={onModify}
          className="rounded-lg border border-border-strong py-2.5 text-center text-sm font-bold text-text hover:border-text-dim"
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
