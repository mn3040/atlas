import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { ItemStation } from './ItemStation'
import type { Day, Item } from '../types/trip'

export function DayLine({
  day,
  items,
  color,
  dayNumber,
  onReorder,
  onDelete,
  onAddClick,
}: {
  day: Day
  items: Item[]
  color: string
  dayNumber: number
  onReorder: (dayId: string, orderedItemIds: string[]) => void
  onDelete: (id: string) => void
  onAddClick: (date: string) => void
}) {
  const itemIds = items.map((s) => s.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = itemIds.indexOf(String(active.id))
    const newIndex = itemIds.indexOf(String(over.id))
    onReorder(day.id, arrayMove(itemIds, oldIndex, newIndex))
  }

  const date = new Date(`${day.date}T00:00:00`)
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-baseline gap-3">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <h2 className="font-display text-2xl font-medium tracking-tight text-text">
          Day {dayNumber}
        </h2>
        <span className="font-mono text-xs uppercase tracking-wide text-text-dim">
          {label} · {weekday}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 pl-8 text-sm text-text-dim">Nothing planned yet.</p>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div>
              {items.map((item) => (
                <ItemStation key={item.id} item={item} color={color} onDelete={onDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={() => onAddClick(day.date)}
        className="mt-2 flex items-center gap-1 pl-8 text-sm text-text-dim hover:text-line-2"
      >
        <Plus size={14} /> Add to this day
      </button>
    </section>
  )
}
