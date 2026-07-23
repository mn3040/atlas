import { AlertTriangle, CalendarCheck, Clock3, MapPin, Star, X } from 'lucide-react'
import type { Day, Item, ItemVoteSummary, Trip } from '../types/trip'

export function TripBriefModal({
  trip,
  days,
  items,
  voteSummary,
  onClose,
  onSelectItem,
}: {
  trip: Trip
  days: Day[]
  items: Item[]
  voteSummary: Record<string, ItemVoteSummary>
  onClose: () => void
  onSelectItem: (item: Item) => void
}) {
  const activeItems = items.filter((item) => item.type !== 'stay')
  const missingTimes = activeItems.filter((item) => !item.startTime)
  const missingLocations = items.filter((item) => !item.locationLabel || item.lat === 0 || item.lng === 0)
  const bookedItems = items.filter(
    (item) => item.confirmationNumber || item.flightNumber || /ticket|reservation|booking|required/i.test(item.priceLabel ?? ''),
  )
  const votedItems = items.filter((item) => (voteSummary[item.id]?.voters.length ?? 0) > 0)
  const readiness = Math.round(
    average([
      activeItems.length ? (activeItems.length - missingTimes.length) / activeItems.length : 1,
      items.length ? (items.length - missingLocations.length) / items.length : 1,
      trip.visibility === 'group' && activeItems.length ? votedItems.length / activeItems.length : 1,
    ]) * 100,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-start sm:justify-end sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close trip brief" onClick={onClose} />
      <section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-paper">Trip brief</p>
            <h2 className="text-lg font-extrabold text-text">Readiness check</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close trip brief"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-ink p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-extrabold text-text">{trip.name}</span>
            <span className="rounded-md bg-surface px-2 py-1 text-sm font-extrabold text-green">{readiness}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-green" style={{ width: `${readiness}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-dim">
            Based on scheduled stops, usable locations, and group vote coverage.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Metric icon={CalendarCheck} label="Days" value={days.length} />
          <Metric icon={MapPin} label="Stops" value={items.length} />
          <Metric icon={Clock3} label="Missing times" value={missingTimes.length} warning={missingTimes.length > 0} />
          <Metric icon={Star} label="Group picks" value={votedItems.length} />
        </div>

        <IssueList title="Needs time" items={missingTimes} empty="Every active stop has a time." onSelectItem={onSelectItem} onClose={onClose} />
        <IssueList
          title="Needs location"
          items={missingLocations}
          empty="Every stop has a usable location."
          onSelectItem={onSelectItem}
          onClose={onClose}
        />

        {bookedItems.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-ink p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dimmer">Bookings tracked</p>
            <div className="flex flex-wrap gap-1.5">
              {bookedItems.slice(0, 8).map((item) => (
                <span key={item.id} className="rounded-md bg-surface px-2 py-1 text-[10px] font-bold text-text-dim">
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: typeof MapPin
  label: string
  value: number
  warning?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-ink px-3 py-2">
      <p className="flex items-center gap-1.5 text-lg font-extrabold text-text">
        <Icon size={14} className={warning ? 'text-line-4' : 'text-green'} /> {value}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-text-dim">{label}</p>
    </div>
  )
}

function IssueList({
  title,
  items,
  empty,
  onSelectItem,
  onClose,
}: {
  title: string
  items: Item[]
  empty: string
  onSelectItem: (item: Item) => void
  onClose: () => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-ink p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dimmer">
        <AlertTriangle size={12} /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-text-dim">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectItem(item)
                  onClose()
                }}
                className="w-full truncate rounded-md bg-surface px-2 py-1.5 text-left text-xs font-bold text-text hover:text-paper"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
