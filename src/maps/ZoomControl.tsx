import { Minus, Plus } from 'lucide-react'

export function ZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  const label = `${Math.round((zoom / 22) * 100)}%`

  return (
    <div className="absolute right-3 top-14 z-10 flex items-center gap-2.5 rounded-full border border-border-strong bg-surface/90 px-2.5 py-1.5 md:bottom-4 md:right-4 md:top-auto">
      <button
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="flex h-[22px] w-[22px] items-center justify-center text-text-dim hover:text-text"
      >
        <Minus size={14} />
      </button>
      <span className="min-w-[32px] text-center text-[10.5px] text-text-dim">{label}</span>
      <button
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="flex h-[22px] w-[22px] items-center justify-center text-text-dim hover:text-text"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
