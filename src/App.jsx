import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SplashScreen from './components/SplashScreen'
import AppLayout from './components/layout/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import PeopleView from './pages/admin/PeopleView'
import MemberDetail from './pages/admin/MemberDetail'
import Settings from './pages/admin/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
})

function AppRoutes() {
  const { session, isLoading, isAdmin } = useAuth()

  if (isLoading) return <SplashScreen />

  const authed = Boolean(session)

  return (
    <Routes>
      <Route path="/" element={authed ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={authed ? <Navigate to="/dashboard" replace /> : <Login />} />

      {authed && (
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/history" element={<History />} />
          {isAdmin && (
            <>
              <Route path="/admin" element={<PeopleView />} />
              <Route path="/admin/member/:id" element={<MemberDetail />} />
              <Route path="/admin/settings" element={<Settings />} />
            </>
          )}
        </Route>
      )}

      <Route path="*" element={<Navigate to={authed ? '/dashboard' : '/'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
