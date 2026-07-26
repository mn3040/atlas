import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSession } from './hooks/useSession'
import { installGlobalErrorMonitoring } from './utils/errorMonitoring'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const TripDashboard = lazy(() => import('./pages/TripDashboard'))
const TripDetail = lazy(() => import('./pages/TripDetail'))
const JoinTrip = lazy(() => import('./pages/JoinTrip'))
const CommandTab = lazy(() => import('./pages/CommandTab'))
const BudgetHub = lazy(() => import('./pages/BudgetHub'))
const DocumentWallet = lazy(() => import('./pages/DocumentWallet'))
const PackingList = lazy(() => import('./pages/PackingList'))

function AppLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center font-mono text-sm text-text-dim">
      {label}
    </div>
  )
}

function WithSession({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession()

  if (loading || !session) return <AppLoading />

  return <Suspense fallback={<AppLoading label="Loading page..." />}>{children}</Suspense>
}

/** Opacity-only cross-fade between routes -- deliberately never animates
 * transform/filter on this wrapper. Either one would make this element a
 * new containing block for its position:fixed descendants (every modal in
 * the app uses `fixed inset-0`), silently trapping them inside this page
 * wrapper's box instead of covering the real viewport. */
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeInOut' }}
      >
        <Routes location={location}>
          <Route
            path="/"
            element={
              <WithSession>
                <Dashboard />
              </WithSession>
            }
          />
          <Route
            path="/trips/:tripId"
            element={
              <WithSession>
                <TripDashboard />
              </WithSession>
            }
          />
          <Route
            path="/trips/:tripId/itinerary"
            element={
              <WithSession>
                <TripDetail />
              </WithSession>
            }
          />
          <Route
            path="/trips/:tripId/command"
            element={
              <WithSession>
                <CommandTab />
              </WithSession>
            }
          />
          <Route
            path="/trips/:tripId/budget"
            element={
              <WithSession>
                <BudgetHub />
              </WithSession>
            }
          />
          <Route
            path="/trips/:tripId/documents"
            element={
              <WithSession>
                <DocumentWallet />
              </WithSession>
            }
          />
          <Route
            path="/trips/:tripId/packing"
            element={
              <WithSession>
                <PackingList />
              </WithSession>
            }
          />
          <Route
            path="/join/:token"
            element={
              <WithSession>
                <JoinTrip />
              </WithSession>
            }
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  useEffect(() => installGlobalErrorMonitoring(), [])

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  )
}

export default App
