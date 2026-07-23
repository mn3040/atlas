import { Star } from 'lucide-react'
import type { DayOptionView } from '../utils/mustSee'
import type { Item, ItemVoteSummary } from '../types/trip'

const OPTIONS: Array<{ id: DayOptionView; label: string; description: string }> = [
  { id: 'all', label: 'All stops', description: 'Full day plan' },
  { id: 'must-see', label: 'Must-see', description: 'Starred priorities' },
  { id: 'flexible', label: 'Flexible', description: 'Everything else' },
]

export function DayOptionsPanel({
  items,
  mustSeeIds,
  voteSummary,
  groupVoting,
  view,
  onViewChange,
}: {
  items: Item[]
  mustSeeIds: Set<string>
  voteSummary?: Record<string, ItemVoteSummary>
  groupVoting?: boolean
  view: DayOptionView
  onViewChange: (view: DayOptionView) => void
}) {
  const mustSeeCount = items.filter((item) => mustSeeIds.has(item.id)).length
  const flexibleCount = items.length - mustSeeCount
  const groupPickCount = items.filter((item) => (voteSummary?.[item.id]?.voters.length ?? 0) > 0).length
  const counts: Record<DayOptionView, number> = {
    all: items.length,
    'must-see': mustSeeCount,
    flexible: flexibleCount,
  }

  return (
    <section className="mb-4 border border-border bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-paper">Day options</p>
          <p className="mt-1 text-[11px] leading-snug text-text-dim">
            {groupVoting ? `${groupPickCount} stops have group interest.` : 'Toggle branches for this day.'}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-3 text-paper">
          <Star size={15} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((option) => {
          const active = view === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onViewChange(option.id)}
              className="rounded-md border px-2 py-2 text-left transition-colors"
              style={{
                background: active ? 'var(--color-green)' : 'var(--color-ink)',
                borderColor: active ? 'var(--color-green)' : 'var(--color-border)',
                color: active ? 'var(--color-ink)' : 'var(--color-text)',
              }}
            >
              <span className="block text-sm font-extrabold leading-none">{counts[option.id]}</span>
              <span className="mt-1 block text-[10px] font-bold">{option.label}</span>
              <span className="mt-0.5 block text-[9px] opacity-70">{option.description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
