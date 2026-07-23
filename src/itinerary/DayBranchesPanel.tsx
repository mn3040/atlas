import { GitBranch, Vote } from 'lucide-react'
import type { DayBranch } from '../utils/branches'

export function DayBranchesPanel({
  branches,
  activeBranchId,
  onSelectBranch,
}: {
  branches: DayBranch[]
  activeBranchId: string
  onSelectBranch: (branchId: string) => void
}) {
  if (branches.length === 0) return null

  return (
    <section className="mb-4 rounded-lg border border-border bg-ink p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-green">
            <GitBranch size={12} /> Route branches
          </p>
          <p className="mt-1 text-[11px] leading-snug text-text-dim">Toggle a possible version of this day and watch the map follow it.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <BranchButton
          label="All"
          detail={`${branches.length} plans`}
          active={activeBranchId === 'all'}
          onClick={() => onSelectBranch('all')}
        />
        {branches.map((branch) => (
          <BranchButton
            key={branch.id}
            label={branch.label}
            detail={`${branch.itemIds.length} stops / ${branch.voteCount} votes`}
            active={activeBranchId === branch.id}
            onClick={() => onSelectBranch(branch.id)}
          />
        ))}
      </div>
    </section>
  )
}

function BranchButton({
  label,
  detail,
  active,
  onClick,
}: {
  label: string
  detail: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[148px] rounded-md border px-3 py-2 text-left transition-colors"
      style={{
        background: active ? 'var(--color-paper)' : 'var(--color-surface)',
        borderColor: active ? 'var(--color-paper)' : 'var(--color-border)',
        color: active ? 'var(--color-ink)' : 'var(--color-text)',
      }}
    >
      <span className="block truncate text-[12px] font-extrabold">{label}</span>
      <span className="mt-1 flex items-center gap-1 text-[10px] font-bold opacity-70">
        <Vote size={11} /> {detail}
      </span>
    </button>
  )
}
