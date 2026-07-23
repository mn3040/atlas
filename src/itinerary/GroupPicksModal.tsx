import { Star, Trophy, X } from 'lucide-react'
import type { Day, Item, ItemVoteSummary } from '../types/trip'

export function GroupPicksModal({
  days,
  items,
  voteSummary,
  onClose,
  onSelectItem,
}: {
  days: Day[]
  items: Item[]
  voteSummary: Record<string, ItemVoteSummary>
  onClose: () => void
  onSelectItem: (item: Item) => void
}) {
  const ranked = items
    .filter((item) => item.type === 'activity')
    .map((item) => ({
      item,
      votes: voteSummary[item.id]?.voters ?? [],
      day: days.find((day) => day.id === item.dayId) ?? null,
    }))
    .sort((a, b) => b.votes.length - a.votes.length || a.item.startDate.localeCompare(b.item.startDate))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-start sm:justify-end sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close group picks" onClick={onClose} />
      <section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Group picks</p>
            <h2 className="text-lg font-extrabold text-text">Consensus board</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close group picks"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Metric label="Activities" value={ranked.length} />
          <Metric label="With votes" value={ranked.filter((entry) => entry.votes.length > 0).length} />
          <Metric label="Total votes" value={ranked.reduce((sum, entry) => sum + entry.votes.length, 0)} />
        </div>

        {ranked.length === 0 ? (
          <p className="rounded-md border border-border bg-ink px-3 py-4 text-sm text-text-dim">No activities to vote on yet.</p>
        ) : (
          <ol className="space-y-2">
            {ranked.map(({ item, votes, day }, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-ink p-3 text-left hover:border-green"
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-extrabold"
                    style={{
                      background: index === 0 && votes.length > 0 ? 'var(--color-paper)' : 'var(--color-surface-3)',
                      color: index === 0 && votes.length > 0 ? 'var(--color-ink)' : 'var(--color-text-dim)',
                    }}
                  >
                    {index === 0 && votes.length > 0 ? <Trophy size={14} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-text">{item.name}</span>
                    <span className="mt-1 block text-xs text-text-dim">
                      {day?.label ?? item.startDate} / {item.locationLabel?.split(',')[0] ?? 'Location'}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {votes.length === 0 ? (
                        <span className="rounded-md bg-surface px-2 py-1 text-[10px] font-bold uppercase text-text-dim">No votes yet</span>
                      ) : (
                        votes.map((voter) => (
                          <span
                            key={voter.userId}
                            className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[10px] font-bold text-text"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: voter.avatarColor }}
                              aria-hidden="true"
                            />
                            {voter.displayName}
                          </span>
                        ))
                      )}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs font-extrabold text-paper">
                    <Star size={12} fill={votes.length ? 'var(--color-paper)' : 'none'} /> {votes.length}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-ink px-3 py-2">
      <p className="text-lg font-extrabold text-text">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-text-dim">{label}</p>
    </div>
  )
}
