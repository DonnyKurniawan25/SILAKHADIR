import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from './Loading'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading fullscreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (roles && roles.length && !roles.includes(user.role)) {
    return <Navigate to="/admin" replace />
  }
  return children
}
