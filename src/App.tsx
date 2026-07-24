import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSession } from './hooks/useSession'
import { installGlobalErrorMonitoring } from './utils/errorMonitoring'

const Dashboard = lazy(() => import('./pages/Dashboard'))
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

function App() {
  useEffect(() => installGlobalErrorMonitoring(), [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
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
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
