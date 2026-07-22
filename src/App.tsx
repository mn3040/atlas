import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import Dashboard from './pages/Dashboard'
import TripDetail from './pages/TripDetail'

function WithSession({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession()

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-sm text-text-dim">
        Loading…
      </div>
    )
  }

  return <>{children}</>
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
      </Routes>
    </BrowserRouter>
  )
}

export default App
