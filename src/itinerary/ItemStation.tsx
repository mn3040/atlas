import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { iconForItem } from '../utils/categoryIcons'
import type { Item } from '../types/trip'

export function ItemStation({
  item,
  color,
  onDelete,
}: {
  item: Item
  color: string
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const Icon = iconForItem(item.type, item.category)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-center gap-3 py-2.5 pl-8 ${isDragging ? 'opacity-50' : ''}`}
    >
      <span
        className="absolute left-[5px] h-3.5 w-3.5 rounded-full border-2 bg-ink"
        style={{ borderColor: color }}
      />
      <div className="flex flex-1 items-center gap-3 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <Icon size={16} className="shrink-0 text-text-dim" />
        <span className="flex-1 text-text">
          {item.name}
          {item.type === 'flight' && item.location2Label && (
            <span className="ml-2 font-mono text-xs text-text-dim">
              {shortLabel(item.locationLabel)} → {shortLabel(item.location2Label)}
            </span>
          )}
        </span>
        {item.startTime && (
          <span className="font-mono text-xs text-text-dim">
            {item.startTime}
            {item.type === 'flight' && item.endTime ? ` – ${item.endTime}` : ''}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="opacity-0 text-text-dim hover:text-line-4 group-hover:opacity-100"
        aria-label={`Remove ${item.name}`}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function shortLabel(label: string | null): string {
  if (!label) return ''
  return label.split(',')[0]
}
