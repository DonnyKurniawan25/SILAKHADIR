import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import { BrandingProvider } from './context/BrandingContext'

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrandingProvider>
  )
}
