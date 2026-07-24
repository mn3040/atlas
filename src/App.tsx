import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSession } from './hooks/useSession'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const TripDetail = lazy(() => import('./pages/TripDetail'))
const JoinTrip = lazy(() => import('./pages/JoinTrip'))
const BudgetHub = lazy(() => import('./pages/BudgetHub'))
const DocumentWallet = lazy(() => import('./pages/DocumentWallet'))

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
  return (
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
          path="/join/:token"
          element={
            <WithSession>
              <JoinTrip />
            </WithSession>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
