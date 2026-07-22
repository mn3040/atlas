import type { Day } from '../types/trip'

export function DaySelect({
  days,
  activeDayId,
  onSelect,
}: {
  days: Day[]
  activeDayId: string | null
  onSelect: (dayId: string) => void
}) {
  return (
    <select
      value={activeDayId ?? ''}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-md border border-border-strong bg-surface-3 px-2.5 py-1.5 text-[11.5px] font-semibold text-text focus:outline-none"
    >
      {days.map((day, index) => (
        <option key={day.id} value={day.id}>
          Day {index + 1}
        </option>
      ))}
    </select>
  )
}
