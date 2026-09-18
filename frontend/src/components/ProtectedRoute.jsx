import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  // Wait for the silent-refresh-from-cookie attempt (see AuthProvider) to
  // settle before deciding to redirect — otherwise a valid session would
  // briefly bounce to /login on every full page reload while the access
  // token is still being restored from the httpOnly cookie.
  if (isInitializing) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
