import { ChevronLeft, ChevronRight } from 'lucide-react'

export function DayPager({
  label,
  onPrev,
  onNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface/90 px-3 py-1.5 shadow-lg backdrop-blur">
      <button onClick={onPrev} aria-label="Previous day" className="text-text-dim hover:text-text">
        <ChevronLeft size={16} />
      </button>
      <span className="whitespace-nowrap font-mono text-xs font-medium text-text">{label}</span>
      <button onClick={onNext} aria-label="Next day" className="text-text-dim hover:text-text">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
