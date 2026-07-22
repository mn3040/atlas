import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, Pencil } from 'lucide-react'
import { actionForItem } from '../utils/itemActions'
import { emojiForItem } from '../utils/categoryIcons'
import { formatTime } from '../utils/time'
import type { Item } from '../types/trip'

export function ItemStation({
  item,
  number,
  color,
  isLast,
  selected,
  onSelect,
  onAction,
  onEdit,
  onDelete,
}: {
  item: Item
  number: number
  color: string
  isLast: boolean
  selected: boolean
  onSelect: (id: string) => void
  onAction: (item: Item) => void
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const { label: actionLabel, action } = actionForItem(item)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex gap-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-none flex-col items-center pt-0.5">
        <span
          className="z-[2] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
          style={{
            background: selected ? color : 'var(--color-surface-3)',
            borderColor: selected ? color : 'var(--color-ink)',
          }}
        >
          {number}
        </span>
        {!isLast && (
          <div
            className="mt-1 w-0.5 flex-1"
            style={{
              minHeight: '76px',
              backgroundImage: `repeating-linear-gradient(0deg, ${color}55 0 4px, transparent 4px 8px)`,
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 pb-5">
        {item.startTime && (
          <p className="mb-1 text-[11px] font-semibold text-text-dimmer">
            {formatTime(item.startTime)}
            {item.type === 'flight' && item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
          </p>
        )}
        <div
          onClick={() => onSelect(item.id)}
          {...attributes}
          {...listeners}
          className="relative flex cursor-pointer gap-3 rounded-xl border p-2.5 transition-colors active:cursor-grabbing"
          style={{
            background: selected ? 'var(--color-surface-2)' : 'var(--color-surface)',
            borderColor: selected ? color : 'var(--color-border)',
          }}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-surface-3 text-xl">
            {item.photoUrl ? (
              <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <span>{emojiForItem(item.type, item.category)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 truncate text-[13.5px] font-bold text-text">{item.name}</p>
            {item.locationLabel &&
              (item.googleMapsUrl ? (
                <a
                  href={item.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mb-0.5 block truncate text-[10.5px] text-text-dim hover:text-paper hover:underline"
                >
                  {item.locationLabel.split(',')[0]} &rsaquo;
                </a>
              ) : (
                <p className="mb-0.5 truncate text-[10.5px] text-text-dim">{item.locationLabel.split(',')[0]}</p>
              ))}
            {item.priceLabel && <p className="mb-1.5 text-[10.5px] text-text-dim">{item.priceLabel}</p>}
            {action === 'maps' && item.googleMapsUrl ? (
              <a
                href={item.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block rounded-md bg-surface-3 px-2.5 py-1.5 text-[10.5px] font-bold text-paper"
              >
                {actionLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  action === 'maps' ? onEdit(item) : onAction(item)
                }}
                className="inline-block rounded-md bg-surface-3 px-2.5 py-1.5 text-[10.5px] font-bold text-paper"
              >
                {actionLabel}
              </button>
            )}
          </div>
          <div className="absolute right-1.5 top-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-text-dim hover:text-text"
              aria-label={`Edit ${item.name}`}
            >
              <Pencil size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item.id)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-text-dim hover:text-line-4"
              aria-label={`Remove ${item.name}`}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
