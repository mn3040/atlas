import { lineColorForIndex } from '../utils/lineColors'
import type { Day } from '../types/trip'

export function DayTabs({
  days,
  activeDayId,
  onSelect,
}: {
  days: Day[]
  activeDayId: string | null
  onSelect: (dayId: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((day, index) => {
        const isActive = day.id === activeDayId
        const date = new Date(`${day.date}T00:00:00`)
        const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return (
          <button
            key={day.id}
            onClick={() => onSelect(day.id)}
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
              isActive
                ? 'border-transparent bg-paper text-ink'
                : 'border-border bg-surface text-text-dim hover:text-text'
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: lineColorForIndex(index) }}
            />
            <span className="whitespace-nowrap">
              <span className="font-display text-base font-medium leading-none">Day {index + 1}</span>
              <span className="ml-1.5 font-mono text-[11px] uppercase tracking-wide opacity-80">
                {label}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
