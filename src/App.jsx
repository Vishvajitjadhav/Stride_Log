import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SplashScreen from './components/SplashScreen'
import PendingApproval from './components/PendingApproval'
import AppLayout from './components/layout/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import PeopleView from './pages/admin/PeopleView'
import MemberDetail from './pages/admin/MemberDetail'
import TeamAnalytics from './pages/admin/TeamAnalytics'
import Approvals from './pages/admin/Approvals'
import Settings from './pages/admin/Settings'

// Lazy-loaded so the heavy SheetJS dependency stays out of the initial bundle.
const ImportData = lazy(() => import('./pages/ImportData'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
})

function AppRoutes() {
  const { session, isLoading, isStaff, isAdmin, isApproved, profileLoaded } = useAuth()

  if (isLoading) return <SplashScreen />

  const authed = Boolean(session)

  // The password-reset link establishes a recovery session; this route must
  // stay reachable regardless of approval state.
  const onResetRoute = window.location.pathname === '/reset-password'

  // Logged in but profile still loading — avoid flashing the pending screen.
  if (authed && !profileLoaded && !onResetRoute) return <SplashScreen />

  // Logged in but not yet approved by an admin.
  if (authed && !isApproved && !onResetRoute) return <PendingApproval />

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={authed ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={authed ? <Navigate to="/dashboard" replace /> : <Login />} />

      {authed && (
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/history" element={<History />} />
          <Route path="/import" element={
            <Suspense fallback={<div className="text-sm text-gray-400 p-8">Loading…</div>}>
              <ImportData />
            </Suspense>
          } />
          {isStaff && (
            <>
              <Route path="/admin" element={<PeopleView />} />
              <Route path="/admin/member/:id" element={<MemberDetail />} />
              <Route path="/admin/analytics" element={<TeamAnalytics />} />
              {isAdmin && <Route path="/admin/approvals" element={<Approvals />} />}
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
