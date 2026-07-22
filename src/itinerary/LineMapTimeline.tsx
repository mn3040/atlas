import { DayLine } from './DayLine'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day, Item } from '../types/trip'

export function LineMapTimeline({
  days,
  itemsByDay,
  onReorder,
  onDelete,
  onAddClick,
}: {
  days: Day[]
  itemsByDay: Record<string, Item[]>
  onReorder: (dayId: string, orderedItemIds: string[]) => void
  onDelete: (id: string) => void
  onAddClick: (date: string) => void
}) {
  return (
    <div>
      {days.map((day, index) => (
        <div key={day.id} id={`day-${day.id}`}>
          <DayLine
            day={day}
            items={itemsByDay[day.id] ?? []}
            color={lineColorForIndex(index)}
            dayNumber={index + 1}
            onReorder={onReorder}
            onDelete={onDelete}
            onAddClick={onAddClick}
          />
        </div>
      ))}
    </div>
  )
}
