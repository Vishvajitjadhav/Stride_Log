import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SplashScreen from './components/SplashScreen'
import AppLayout from './components/layout/AppLayout'
import Toaster from './components/Toaster'
import Landing from './pages/Landing'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import MyDay from './pages/MyDay'
import Profile from './pages/Profile'
import { homePath } from './components/layout/nav'

// Staff / admin pages and heavy dependencies load on demand.
const load = {
  team: () => import('./pages/Team'),
  reports: () => import('./pages/Reports'),
  progress: () => import('./pages/Progress'),
}
const Progress = lazy(load.progress)
const Team = lazy(load.team)
const MemberDetail = lazy(() => import('./pages/MemberDetail'))
const Reports = lazy(load.reports)
const Assigned = lazy(() => import('./pages/Assigned'))
const Projects = lazy(() => import('./pages/Projects'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Admin = lazy(() => import('./pages/admin/Admin'))
const ImportData = lazy(() => import('./pages/ImportData'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, refetchOnWindowFocus: true, retry: 1 },
  },
})

const Loading = () => <div className="space-y-3"><div className="h-24 bg-surface rounded-md skeleton" /><div className="h-48 bg-surface rounded-md skeleton" /></div>

function Guard({ perm, children }) {
  const { can } = useAuth()
  return can(perm) ? children : <Navigate to={homePath(can)} replace />
}

function LegacyMember() {
  const { id } = useParams()
  return <Navigate to={`/team/${id}`} replace />
}

function AppRoutes() {
  const { session, isLoading, isApproved, profileLoaded, recovering, can, profile } = useAuth()
  const { pathname } = useLocation()

  // Warm up the pages this person will open next, once the app is idle.
  useEffect(() => {
    if (!profileLoaded) return
    const idle = window.requestIdleCallback ?? (cb => setTimeout(cb, 800))
    idle(() => (can('viewTeam') ? [load.team, load.reports] : [load.progress]).forEach(f => f()))
  }, [profileLoaded, can])

  if (isLoading) return <SplashScreen />

  const authed = Boolean(session)
  // Reset / invite links establish a session; this page must stay reachable
  // regardless of approval state.
  const onResetRoute = pathname === '/reset-password'

  if (recovering && !onResetRoute) return <Navigate to="/reset-password" replace />
  if (authed && !profileLoaded && !onResetRoute) return <SplashScreen />
  // Created by an admin with a temporary password: choose a new one first.
  if (authed && isApproved && profile?.must_change_password && !onResetRoute) return <Navigate to="/reset-password" replace />

  // Signed in but not approved (or turned off): landing page with their status, nothing else.
  if (authed && !isApproved && !onResetRoute) {
    return (
      <Routes>
        <Route path="/" element={<Landing pending />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={authed ? <Navigate to={homePath(can)} replace /> : <Landing />} />
      <Route path="/login" element={authed ? <Navigate to={homePath(can)} replace /> : <Login />} />

      {authed && (
        <Route element={<AppLayout />}>
          <Route path="/today" element={<MyDay />} />
          <Route path="/progress" element={<Suspense fallback={<Loading />}><Progress /></Suspense>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/import" element={<Suspense fallback={<Loading />}><ImportData /></Suspense>} />

          <Route path="/team" element={<Guard perm="seeTeamTasks"><Suspense fallback={<Loading />}><Team /></Suspense></Guard>} />
          <Route path="/leaderboard" element={<Guard perm="seeLeaderboard"><Suspense fallback={<Loading />}><Leaderboard /></Suspense></Guard>} />
          <Route path="/team/:id" element={<Guard perm="viewTeam"><Suspense fallback={<Loading />}><MemberDetail /></Suspense></Guard>} />
          <Route path="/reports" element={<Guard perm="viewTeam"><Suspense fallback={<Loading />}><Reports /></Suspense></Guard>} />
          <Route path="/projects" element={<Guard perm="viewTeam"><Suspense fallback={<Loading />}><Projects /></Suspense></Guard>} />
          <Route path="/assigned" element={<Guard perm="assignTasks"><Suspense fallback={<Loading />}><Assigned /></Suspense></Guard>} />
          <Route path="/admin" element={<Guard perm="manageCategories"><Suspense fallback={<Loading />}><Admin /></Suspense></Guard>} />

          {/* Older URLs */}
          <Route path="/log" element={<Navigate to="/today" replace />} />
          <Route path="/dashboard" element={<Navigate to="/progress" replace />} />
          <Route path="/calendar" element={<Navigate to="/progress?view=month" replace />} />
          <Route path="/history" element={<Navigate to="/progress" replace />} />
          <Route path="/more" element={<Navigate to="/profile" replace />} />
          <Route path="/analytics" element={<Navigate to="/reports" replace />} />
          <Route path="/admin/people" element={<Navigate to="/admin?tab=people" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/member/:id" element={<LegacyMember />} />
          <Route path="/admin/analytics" element={<Navigate to="/reports" replace />} />
          <Route path="/admin/approvals" element={<Navigate to="/admin?tab=people" replace />} />
        </Route>
      )}

      <Route path="*" element={<Navigate to={authed ? homePath(can) : '/'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
