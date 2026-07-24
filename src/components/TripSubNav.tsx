import { NavLink } from 'react-router-dom'
import { Compass, FileText, Wallet } from 'lucide-react'

const TABS = [
  { to: '', label: 'Itinerary', icon: Compass, end: true },
  { to: 'budget', label: 'Budget', icon: Wallet, end: false },
  { to: 'documents', label: 'Documents', icon: FileText, end: false },
]

export function TripSubNav({ tripId }: { tripId: string }) {
  return (
    <nav
      className="flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-1"
      aria-label="Trip sections"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={`/trips/${tripId}${to ? `/${to}` : ''}`}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold transition-colors ${
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
