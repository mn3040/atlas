import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { iconForItem } from '../utils/categoryIcons'
import type { Item } from '../types/trip'

export function ItemStation({
  item,
  number,
  color,
  isLast,
  selected,
  onSelect,
  onDelete,
}: {
  item: Item
  number: number
  color: string
  isLast: boolean
  selected: boolean
  onSelect: (id: string) => void
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
      className={`group flex gap-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-col items-center pt-0.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium text-ink"
          style={{ background: color }}
        >
          {number}
        </span>
        {!isLast && (
          <div
            className="mt-1 w-0.5 flex-1"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, ${color}55 0 4px, transparent 4px 8px)`,
            }}
          />
        )}
      </div>

      <div className="flex-1 pb-4">
        {item.startTime && (
          <p className="mb-1 font-mono text-[11px] text-text-dim">
            {item.startTime}
            {item.type === 'flight' && item.endTime ? ` – ${item.endTime}` : ''}
          </p>
        )}
        <div
          onClick={() => onSelect(item.id)}
          {...attributes}
          {...listeners}
          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-colors active:cursor-grabbing ${
            selected ? 'border-transparent bg-surface-2' : 'border-border bg-surface hover:border-text-dim/40'
          }`}
          style={selected ? { boxShadow: `0 0 0 1px ${color}` } : undefined}
        >
          <Icon size={15} className="shrink-0 text-text-dim" />
          <span className="min-w-0 flex-1 truncate text-sm text-text">
            {item.name}
            {item.type === 'flight' && item.location2Label && (
              <span className="ml-2 font-mono text-xs text-text-dim">
                {shortLabel(item.locationLabel)} → {shortLabel(item.location2Label)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(item.id)
            }}
            className="opacity-0 text-text-dim hover:text-line-4 group-hover:opacity-100"
            aria-label={`Remove ${item.name}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function shortLabel(label: string | null): string {
  if (!label) return ''
  return label.split(',')[0]
}
