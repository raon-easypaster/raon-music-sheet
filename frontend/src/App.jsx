import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import LoginForm from './components/LoginForm'
import Dashboard from './pages/Dashboard'
import PublicSetlistView from './pages/PublicSetlistView'
import CopyrightRequestPage from './pages/CopyrightRequestPage'
import CopyrightAdminPage from './pages/CopyrightAdminPage'
import { useAuth } from './context/useAuth'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/share/:token" element={<PublicSetlistView />} />
      <Route path="/copyright" element={<CopyrightRequestPage />} />
      <Route path="/copyright/admin" element={<div className="app-shell"><CopyrightAdminPage /></div>} />
      <Route path="*" element={
        <div className="app-shell">
          {isAuthenticated ? <Dashboard /> : <LoginForm />}
        </div>
      } />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
