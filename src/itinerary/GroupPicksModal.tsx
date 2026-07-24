import { Check, LockKeyhole, Star, Trophy, UnlockKeyhole, Users, X } from 'lucide-react'
import { formatTime } from '../utils/time'
import type { Day, Item, ItemDecision, ItemVoteSummary } from '../types/trip'

export function GroupPicksModal({
  days,
  items,
  voteSummary,
  decisions,
  memberCount,
  canDecide,
  decisionError,
  onClose,
  onSelectItem,
  onDecide,
  onClearDecision,
}: {
  days: Day[]
  items: Item[]
  voteSummary: Record<string, ItemVoteSummary>
  decisions: Record<string, ItemDecision>
  memberCount: number
  canDecide: boolean
  decisionError: string | null
  onClose: () => void
  onSelectItem: (item: Item) => void
  onDecide: (item: Item) => void
  onClearDecision: (dayId: string) => void
}) {
  const dayBoards = days.map((day) => {
    const dayItems = items
      .filter((item) => item.dayId === day.id && item.type === 'activity')
      .map((item) => ({ item, votes: voteSummary[item.id]?.voters ?? [] }))
      .sort((a, b) => b.votes.length - a.votes.length || (a.item.startTime ?? '').localeCompare(b.item.startTime ?? ''))
    const topVotes = dayItems[0]?.votes.length ?? 0
    const tied = topVotes > 0 && dayItems.filter((entry) => entry.votes.length === topVotes).length > 1
    return { day, items: dayItems, decision: decisions[day.id] ?? null, topVotes, tied }
  })
  const totalVotes = Object.values(voteSummary).reduce((sum, summary) => sum + summary.voters.length, 0)
  const decidedCount = Object.keys(decisions).length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-start sm:justify-end sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close decision board" onClick={onClose} />
      <section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Decision mode</p>
            <h2 className="text-lg font-extrabold text-text">Group picks by day</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close decision board"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Metric icon={Users} label="Travelers" value={memberCount || 1} />
          <Metric icon={Star} label="Votes" value={totalVotes} />
          <Metric icon={LockKeyhole} label="Locked" value={decidedCount} />
        </div>

        {decisionError && (
          <p className="mb-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-xs font-semibold text-line-4">
            {decisionError}
          </p>
        )}

        <div className="space-y-3">
          {dayBoards.map(({ day, items: dayItems, decision, topVotes, tied }, dayIndex) => {
            const lockedItem = decision ? dayItems.find((entry) => entry.item.id === decision.itemId)?.item : null
            return (
              <section key={day.id} className="rounded-lg border border-border bg-ink p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dimmer">
                      Day {dayIndex + 1} / {day.date}
                    </p>
                    <h3 className="text-sm font-extrabold text-text">{day.label ?? `Day ${dayIndex + 1}`}</h3>
                  </div>
                  {lockedItem ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-green px-2.5 py-1 text-[10px] font-extrabold uppercase text-ink">
                      <Check size={12} /> Locked
                    </span>
                  ) : tied ? (
                    <span className="rounded-md bg-paper px-2.5 py-1 text-[10px] font-extrabold uppercase text-ink">Tie</span>
                  ) : topVotes > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-[10px] font-extrabold uppercase text-paper">
                      <Trophy size={12} /> Leader
                    </span>
                  ) : null}
                </div>

                {dayItems.length === 0 ? (
                  <p className="rounded-md border border-border bg-surface px-3 py-4 text-sm text-text-dim">No voteable activities yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {dayItems.map(({ item, votes }, index) => {
                      const locked = decision?.itemId === item.id
                      const voteShare = memberCount > 0 ? Math.round((votes.length / memberCount) * 100) : 0
                      return (
                        <li key={item.id}>
                          <div
                            className="grid gap-3 rounded-lg border bg-surface p-3 sm:grid-cols-[1fr_auto]"
                            style={{ borderColor: locked ? 'var(--color-green)' : 'var(--color-border)' }}
                          >
                            <button type="button" onClick={() => onSelectItem(item)} className="min-w-0 text-left">
                              <span className="mb-1 flex flex-wrap items-center gap-2">
                                <span
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-extrabold"
                                  style={{
                                    background: index === 0 && votes.length > 0 ? 'var(--color-paper)' : 'var(--color-surface-3)',
                                    color: index === 0 && votes.length > 0 ? 'var(--color-ink)' : 'var(--color-text-dim)',
                                  }}
                                >
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-text">{item.name}</span>
                              </span>
                              <span className="block text-xs text-text-dim">
                                {[item.startTime ? formatTime(item.startTime) : '', item.locationLabel?.split(',')[0] ?? 'Location']
                                  .filter(Boolean)
                                  .join(' / ')}
                              </span>
                              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink">
                                <span className="block h-full rounded-full bg-green" style={{ width: `${Math.min(100, voteShare)}%` }} />
                              </span>
                              <span className="mt-2 flex flex-wrap gap-1">
                                {votes.length === 0 ? (
                                  <span className="rounded-md bg-ink px-2 py-1 text-[10px] font-bold uppercase text-text-dim">No votes yet</span>
                                ) : (
                                  votes.map((voter) => (
                                    <span
                                      key={voter.userId}
                                      className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-[10px] font-bold text-text"
                                    >
                                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: voter.avatarColor }} aria-hidden="true" />
                                      {voter.displayName}
                                    </span>
                                  ))
                                )}
                              </span>
                            </button>

                            <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                              <span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-extrabold text-paper">
                                <Star size={12} fill={votes.length ? 'var(--color-paper)' : 'none'} /> {votes.length}
                              </span>
                              {canDecide && (
                                <button
                                  type="button"
                                  onClick={() => (locked ? onClearDecision(day.id) : onDecide(item))}
                                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-extrabold ${
                                    locked ? 'border border-border bg-ink text-text-dim' : 'bg-green text-ink'
                                  }`}
                                >
                                  {locked ? <UnlockKeyhole size={13} /> : <LockKeyhole size={13} />}
                                  {locked ? 'Unlock' : 'Lock'}
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-ink px-3 py-2">
      <p className="flex items-center gap-1.5 text-lg font-extrabold text-text">
        <Icon size={14} /> {value}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-text-dim">{label}</p>
    </div>
  )
}
