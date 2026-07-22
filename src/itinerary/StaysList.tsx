import { BedDouble, X } from 'lucide-react'
import type { Item } from '../types/trip'

export function StaysList({ stays, onDelete }: { stays: Item[]; onDelete: (id: string) => void }) {
  if (stays.length === 0) return null

  return (
    <section className="mb-8 border-b border-border pb-6">
      <h3 className="font-mono text-xs uppercase tracking-wide text-text-dim">Where you're staying</h3>
      <div className="mt-3 space-y-2">
        {stays.map((stay) => (
          <div
            key={stay.id}
            className="group flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
          >
            <BedDouble size={18} className="shrink-0 text-line-6" />
            <div className="flex-1">
              <p className="text-text">{stay.name}</p>
              <p className="font-mono text-xs text-text-dim">
                {formatRange(stay.startDate, stay.endDate)}
                {stay.locationLabel ? ` · ${stay.locationLabel.split(',')[0]}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(stay.id)}
              className="opacity-0 text-text-dim hover:text-line-4 group-hover:opacity-100"
              aria-label={`Remove ${stay.name}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatRange(start: string, end: string | null): string {
  const startLabel = new Date(`${start}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  if (!end || end === start) return startLabel
  const endLabel = new Date(`${end}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}
