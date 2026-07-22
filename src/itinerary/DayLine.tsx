import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { ItemStation } from './ItemStation'
import type { Day, Item } from '../types/trip'

// Module-level so the object identity is stable across renders -- useSensor
// memoizes internally keyed on this reference, and a fresh object every
// render defeats that, causing dnd-kit's sensor array to churn.
const POINTER_ACTIVATION_CONSTRAINT = { distance: 8 }

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

  // Without an activation distance, dnd-kit's PointerSensor treats every
  // click as a zero-distance drag and the co-located onClick on each card
  // never fires -- clicking to select an item silently does nothing.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION_CONSTRAINT }))

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
