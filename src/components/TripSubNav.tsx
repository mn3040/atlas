import { NavLink } from 'react-router-dom'
import { Backpack, Compass, FileText, Radar, Wallet } from 'lucide-react'

const TABS = [
  { to: '', label: 'Itinerary', icon: Compass, end: true },
  { to: 'command', label: 'Command', icon: Radar, end: false },
  { to: 'budget', label: 'Budget', icon: Wallet, end: false },
  { to: 'documents', label: 'Documents', icon: FileText, end: false },
  { to: 'packing', label: 'Packing', icon: Backpack, end: false },
]

export function TripSubNav({ tripId }: { tripId: string }) {
  return (
    <nav
      className="flex w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface p-1 sm:w-fit"
      aria-label="Trip sections"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={`/trips/${tripId}${to ? `/${to}` : ''}`}
          end={end}
          className={({ isActive }) =>
            `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-bold transition-colors ${
              isActive ? 'bg-paper text-ink' : 'text-text-dim hover:text-text'
            }`
          }
        >
          <Icon size={13} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
