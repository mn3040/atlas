import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CATEGORY_ICONS } from '../utils/categoryIcons'
import type { Stop } from '../types/trip'

export function StopStation({ stop, color }: { stop: Stop; color: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  })

  const Icon = CATEGORY_ICONS[stop.category]

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-3 py-2.5 pl-8 ${isDragging ? 'opacity-50' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span
        className="absolute left-[5px] h-3.5 w-3.5 rounded-full border-2 bg-ink"
        style={{ borderColor: color }}
      />
      <Icon size={16} className="shrink-0 text-text-dim" />
      <span className="flex-1 text-text">{stop.name}</span>
      {stop.startTime && (
        <span className="font-mono text-xs text-text-dim">{stop.startTime}</span>
      )}
    </div>
  )
}
