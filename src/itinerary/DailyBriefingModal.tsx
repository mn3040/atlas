import { AlertTriangle, CalendarClock, CheckCircle2, CloudSun, MapPin, Star, X } from 'lucide-react'
import { scheduleInsightsForItems } from '../utils/scheduleInsights'
import { formatTime } from '../utils/time'
import type { TravelMode } from '../utils/distance'
import type { Day, Item, ItemDecision, ItemVoteSummary, Trip } from '../types/trip'

export function DailyBriefingModal({
  trip,
  day,
  dayIndex,
  items,
  selectedItem,
  voteSummary,
  decisions,
  travelMode,
  onClose,
  onSelectItem,
}: {
  trip: Trip
  day: Day
  dayIndex: number
  items: Item[]
  selectedItem: Item | undefined
  voteSummary: Record<string, ItemVoteSummary>
  decisions: Record<string, ItemDecision>
  travelMode: TravelMode
  onClose: () => void
  onSelectItem: (item: Item) => void
}) {
  const dayItems = items
    .filter((item) => item.dayId === day.id && item.type !== 'stay')
    .sort((a, b) => a.position - b.position)
  const nextStop = selectedItem && selectedItem.dayId === day.id ? selectedItem : dayItems[0]
  const mustSee = dayItems.filter((item) => (voteSummary[item.id]?.voters.length ?? 0) > 0)
  const timingFlags = scheduleInsightsForItems(dayItems, travelMode)
  const lockedDecision = decisions[day.id]
  const lockedItem = lockedDecision ? dayItems.find((item) => item.id === lockedDecision.itemId) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-start sm:justify-end sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close daily briefing" onClick={onClose} />
      <section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Daily briefing</p>
            <h2 className="text-lg font-extrabold text-text">
              Day {dayIndex + 1} / {formatShortDate(day.date)}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-text-dim">{day.label || trip.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close daily briefing"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <BriefMetric icon={MapPin} label="Stops" value={dayItems.length} />
          <BriefMetric icon={Star} label="Must-see votes" value={mustSee.length} />
          <BriefMetric icon={AlertTriangle} label="Timing flags" value={timingFlags.length} warning={timingFlags.length > 0} />
        </div>

        {nextStop && (
          <button
            type="button"
            onClick={() => {
              onSelectItem(nextStop)
              onClose()
            }}
            className="mb-4 w-full rounded-lg border border-border-strong bg-ink p-3 text-left transition-colors hover:border-paper"
          >
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-paper">
              <CalendarClock size={12} /> Focus stop
            </p>
            <p className="text-base font-extrabold text-text">{nextStop.name}</p>
            <p className="mt-1 text-xs text-text-dim">
              {[formatTime(nextStop.startTime), nextStop.locationLabel].filter(Boolean).join(' / ') || 'No time set yet'}
            </p>
          </button>
        )}

        {lockedItem && (
          <div className="mb-4 rounded-lg border border-green/35 bg-green/10 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green">
              <CheckCircle2 size={12} /> Locked group pick
            </p>
            <p className="mt-1 text-sm font-extrabold text-text">{lockedItem.name}</p>
          </div>
        )}

        {timingFlags.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-ink p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dimmer">
              <AlertTriangle size={12} /> Route state / {modeLabel(travelMode)}
            </p>
            <div className="space-y-1.5">
              {timingFlags.map((insight) => {
                const item = dayItems.find((candidate) => candidate.id === insight.itemId)
                if (!item) return null
                return (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => {
                      onSelectItem(item)
                      onClose()
                    }}
                    className="w-full rounded-md bg-surface px-2 py-1.5 text-left hover:text-paper"
                  >
                    <span className="block text-xs font-bold text-text">{insight.title}</span>
                    <span className="block text-[10.5px] leading-snug text-text-dim">{insight.detail}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-ink p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dimmer">
            <CloudSun size={12} /> Day flow
          </p>
          {dayItems.length === 0 ? (
            <p className="text-xs text-text-dim">No active stops on this day yet.</p>
          ) : (
            <div className="space-y-1.5">
              {dayItems.slice(0, 7).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectItem(item)
                    onClose()
                  }}
                  className="grid w-full grid-cols-[3.75rem_1fr] gap-2 rounded-md bg-surface px-2 py-1.5 text-left"
                >
                  <span className="text-[10.5px] font-bold text-text-dim">{formatTime(item.startTime) || '--'}</span>
                  <span className="truncate text-xs font-bold text-text">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function BriefMetric({
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

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function modeLabel(mode: TravelMode): string {
  return mode === 'walk' ? 'Walking' : mode === 'bike' ? 'Cycling' : mode === 'car' ? 'Car' : mode === 'train' ? 'Train' : 'Flight'
}
