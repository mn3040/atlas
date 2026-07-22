import { DayLine } from './DayLine'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day, Stop, StopCategory } from '../types/trip'

export function LineMapTimeline({
  days,
  stopsByDay,
  onReorder,
  onAddStop,
}: {
  days: Day[]
  stopsByDay: Record<string, Stop[]>
  onReorder: (dayId: string, orderedStopIds: string[]) => void
  onAddStop: (dayId: string, input: { name: string; category: StopCategory; lat: number; lng: number; startTime: string | null }) => void
}) {
  return (
    <div>
      {days.map((day, index) => (
        <div key={day.id} id={`day-${day.id}`}>
          <DayLine
            day={day}
            stops={stopsByDay[day.id] ?? []}
            color={lineColorForIndex(index)}
            dayNumber={index + 1}
            onReorder={onReorder}
            onAddStop={onAddStop}
          />
        </div>
      ))}
    </div>
  )
}
