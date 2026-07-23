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
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-border-strong bg-surface/90 px-3 py-2 backdrop-blur-sm sm:gap-3.5 sm:px-4 md:top-4">
      <button onClick={onPrev} aria-label="Previous day" className="text-text-dim hover:text-text">
        <ChevronLeft size={15} />
      </button>
      <span className="whitespace-nowrap text-[10.5px] font-bold text-text sm:text-[11.5px]">{label}</span>
      <button onClick={onNext} aria-label="Next day" className="text-text-dim hover:text-text">
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
