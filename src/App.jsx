import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SplashScreen from './components/SplashScreen'
import PendingApproval from './components/PendingApproval'
import AppLayout from './components/layout/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import MyDay from './pages/MyDay'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import History from './pages/History'
import Profile from './pages/Profile'
import More from './pages/More'

// Staff / admin pages and heavy dependencies load on demand.
const Team = lazy(() => import('./pages/Team'))
const MemberDetail = lazy(() => import('./pages/MemberDetail'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Assigned = lazy(() => import('./pages/Assigned'))
const People = lazy(() => import('./pages/admin/People'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const ImportData = lazy(() => import('./pages/ImportData'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, refetchOnWindowFocus: true, retry: 1 },
  },
})

const Loading = () => <div className="space-y-3"><div className="h-24 bg-white rounded-xl animate-pulse" /><div className="h-48 bg-white rounded-xl animate-pulse" /></div>

function Guard({ perm, children }) {
  const { can } = useAuth()
  return can(perm) ? children : <Navigate to="/today" replace />
}

function LegacyMember() {
  const { id } = useParams()
  return <Navigate to={`/team/${id}`} replace />
}

function AppRoutes() {
  const { session, isLoading, isApproved, profileLoaded, recovering } = useAuth()
  const { pathname } = useLocation()

  if (isLoading) return <SplashScreen />

  const authed = Boolean(session)
  // Reset / invite links establish a session; this page must stay reachable
  // regardless of approval state.
  const onResetRoute = pathname === '/reset-password'

  if (recovering && !onResetRoute) return <Navigate to="/reset-password" replace />
  if (authed && !profileLoaded && !onResetRoute) return <SplashScreen />
  if (authed && !isApproved && !onResetRoute) return <PendingApproval />

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={authed ? <Navigate to="/today" replace /> : <Landing />} />
      <Route path="/login" element={authed ? <Navigate to="/today" replace /> : <Login />} />

      {authed && (
        <Route element={<AppLayout />}>
          <Route path="/today" element={<MyDay />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/more" element={<More />} />
          <Route path="/import" element={<Suspense fallback={<Loading />}><ImportData /></Suspense>} />

          <Route path="/team" element={<Guard perm="viewTeam"><Suspense fallback={<Loading />}><Team /></Suspense></Guard>} />
          <Route path="/team/:id" element={<Guard perm="viewTeam"><Suspense fallback={<Loading />}><MemberDetail /></Suspense></Guard>} />
          <Route path="/analytics" element={<Guard perm="viewTeam"><Suspense fallback={<Loading />}><Analytics /></Suspense></Guard>} />
          <Route path="/assigned" element={<Guard perm="assignTasks"><Suspense fallback={<Loading />}><Assigned /></Suspense></Guard>} />
          <Route path="/admin/people" element={<Guard perm="managePeople"><Suspense fallback={<Loading />}><People /></Suspense></Guard>} />
          <Route path="/admin/settings" element={<Guard perm="manageCategories"><Suspense fallback={<Loading />}><Settings /></Suspense></Guard>} />

          {/* v1 URLs */}
          <Route path="/log" element={<Navigate to="/today" replace />} />
          <Route path="/admin" element={<Navigate to="/team" replace />} />
          <Route path="/admin/member/:id" element={<LegacyMember />} />
          <Route path="/admin/analytics" element={<Navigate to="/analytics" replace />} />
          <Route path="/admin/approvals" element={<Navigate to="/admin/people" replace />} />
        </Route>
      )}

      <Route path="*" element={<Navigate to={authed ? '/today' : '/'} replace />} />
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
