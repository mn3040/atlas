import { useId } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Backpack, Compass, FileText, Radar, Wallet } from 'lucide-react'

const TABS = [
  { to: 'itinerary', label: 'Itinerary', icon: Compass, end: true },
  { to: 'command', label: 'Command', icon: Radar, end: false },
  { to: 'budget', label: 'Budget', icon: Wallet, end: false },
  { to: 'documents', label: 'Documents', icon: FileText, end: false },
  { to: 'packing', label: 'Packing', icon: Backpack, end: false },
]

/**
 * `dense` drops the text label down to an icon + tooltip. Used wherever this
 * nav sits inside a width-capped column (the itinerary's map sidebar, fixed
 * at 400px on desktop) that never has room for 5 labeled pills, so it never
 * needs to overflow-scroll to stay usable. The wider single-column pages
 * (Budget, Documents, Packing, Command) have room to keep labels.
 */
export function TripSubNav({ tripId, dense = false }: { tripId: string; dense?: boolean }) {
  // Scopes the shared layoutId to this exact TripSubNav instance, so the
  // sliding pill only animates between this nav's own tabs -- never jumps
  // across two instances if more than one ever renders at once.
  const pillId = useId()

  return (
    <nav
      className={`flex items-center gap-1 rounded-md border border-border bg-surface p-1 ${
        dense ? 'w-fit' : 'w-full overflow-x-auto sm:w-fit'
      }`}
      aria-label="Trip sections"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={`/trips/${tripId}${to ? `/${to}` : ''}`}
          end={end}
          title={dense ? label : undefined}
          className={({ isActive }) =>
            `relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded text-xs font-bold transition-colors ${
              dense ? 'px-2 py-1.5' : 'px-3 py-1.5'
            } ${isActive ? 'text-ink' : 'text-text-dim hover:text-text'}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={`${pillId}-active-tab`}
                  className="absolute inset-0 -z-10 rounded bg-paper"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Icon size={13} />
              <span className={dense ? 'sr-only' : ''}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
