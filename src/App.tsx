import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TripDetail from './pages/TripDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
