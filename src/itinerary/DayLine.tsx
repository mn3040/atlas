import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { ItemStation } from './ItemStation'
import type { TravelMode } from '../utils/distance'
import type { Day, Item, ItemVoteSummary } from '../types/trip'

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
  onToggleMustSee,
  getMapsUrl,
  getBookingUrl,
  mustSeeIds,
  voteSummary,
  groupVoting,
  onAddClick,
  travelMode,
  showCommutes,
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
  onToggleMustSee: (id: string) => void
  getMapsUrl: (item: Item) => string
  getBookingUrl: (item: Item) => string
  mustSeeIds: Set<string>
  voteSummary?: Record<string, ItemVoteSummary>
  groupVoting?: boolean
  onAddClick: (date: string) => void
  travelMode: TravelMode
  showCommutes: boolean
}) {
  const itemIds = items.map((s) => s.id)
  const coarsePointer = useCoarsePointer()
  const dragEnabled = !coarsePointer

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
              {items.map((item, index) => {
                const nextItem = items[index + 1]
                return (
                  <ItemStation
                    key={item.id}
                    item={item}
                    nextItem={showCommutes ? nextItem : undefined}
                    travelMode={travelMode}
                    dragEnabled={dragEnabled}
                    number={index + 1}
                    color={color}
                    isLast={index === items.length - 1}
                    selected={item.id === selectedItemId}
                    onSelect={onSelectItem}
                    onAction={onAction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleMustSee={onToggleMustSee}
                    mapsUrl={getMapsUrl(item)}
                    bookingUrl={getBookingUrl(item)}
                    mustSee={mustSeeIds.has(item.id)}
                    voteSummary={voteSummary?.[item.id]}
                    groupVoting={groupVoting}
                  />
                )
              })}
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

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches : false,
  )

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return coarse
}
