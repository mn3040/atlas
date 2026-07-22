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
  selectedItemId,
  onSelectItem,
  onAction,
  onEdit,
  onReorder,
  onDelete,
  onAddClick,
}: {
  day: Day
  items: Item[]
  color: string
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onAction: (item: Item) => void
  onEdit: (item: Item) => void
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

  return (
    <div>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-text-dim">Nothing planned yet.</p>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div>
              {items.map((item, index) => (
                <ItemStation
                  key={item.id}
                  item={item}
                  number={index + 1}
                  color={color}
                  isLast={index === items.length - 1}
                  selected={item.id === selectedItemId}
                  onSelect={onSelectItem}
                  onAction={onAction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={() => onAddClick(day.date)}
        className="mt-1 flex items-center gap-1 text-sm font-semibold text-text-dim hover:text-paper"
      >
        <Plus size={14} /> Add to this day
      </button>
    </div>
  )
}
