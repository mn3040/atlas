import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'

const NAV_LINKS = ['AI Chat', 'Explore', 'Itinerary', 'Journal', 'Community'] as const

export function TopNav({ active }: { active?: (typeof NAV_LINKS)[number] }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-7 py-3.5">
      <div className="flex items-center gap-[28px]">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-[22px] w-[22px] rounded-md bg-paper" />
          <span className="text-[15px] font-extrabold tracking-wide text-text">ATLAS</span>
        </Link>
        <div className="flex gap-[22px]">
          {NAV_LINKS.map((label) =>
            label === active ? (
              <span key={label} className="flex items-center gap-1.5 text-[12.5px] font-bold text-paper">
                <span className="h-1.5 w-1.5 rounded-full bg-paper" />
                {label}
              </span>
            ) : (
              <span
                key={label}
                className="cursor-default text-[12.5px] font-semibold text-text-dim"
                title="Not built yet"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </div>
      <div className="flex items-center gap-[18px]">
        <Settings size={16} className="text-text-dim" />
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-surface-2" />
          <span className="text-xs font-semibold text-text">Guest</span>
        </div>
      </div>
    </div>
  )
}
