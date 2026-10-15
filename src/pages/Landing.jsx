import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogoMark, Wordmark } from '../components/Logo'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'

const FEATURES = [
  { icon: 'today', title: 'Plan the day', text: 'Employees list their tasks, mark progress and submit the day in under a minute, on phone or desktop.' },
  { icon: 'team', title: 'See the whole team', text: 'Managers see who is working on what today, and every day of the week at a glance.' },
  { icon: 'analytics', title: 'Report with confidence', text: 'Clear weekly and monthly numbers, plain observations and detailed PDF reports for every employee.' },
]

// Signed in but not approved yet (or turned off): the landing page with a
// status panel instead of the sign in button. Nothing inside the app opens.
function AccessStatus() {
  const { profile, user, refreshProfile } = useAuth()
  const inactive = profile?.is_active === false
  const [checking, setChecking] = useState(false)

  // Re-check every 20s so the app opens as soon as HR or an admin approves.
  useEffect(() => {
    if (inactive) return
    const t = setInterval(refreshProfile, 20_000)
    return () => clearInterval(t)
  }, [inactive, refreshProfile])

  async function checkNow() {
    setChecking(true)
    await refreshProfile()
    setTimeout(() => setChecking(false), 600)
  }

  return (
    <div className="mt-10 max-w-lg rounded-lg bg-white/[0.06] ring-1 ring-white/15 backdrop-blur-sm p-5 sm:p-6 page-in">
      <div className="flex items-center gap-2.5">
        <span className="relative flex w-2.5 h-2.5">
          {!inactive && <span className="absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-60 animate-ping" />}
          <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${inactive ? 'bg-red-400' : 'bg-accent-500'}`} />
        </span>
        <p className="text-[15px] font-semibold text-white">{inactive ? 'Your access is turned off' : 'Your account is waiting for approval'}</p>
      </div>
      <p className="mt-2.5 text-sm text-[#c8d4e6] leading-relaxed">
        {inactive
          ? 'Contact HR or your admin if you think this is a mistake.'
          : <>You are signed in as <span className="text-white font-medium">{user?.email}</span>. HR or an admin will approve
            your account and choose your role. This page opens the app by itself once you are approved.</>}
      </p>
      {!inactive && (
        <button onClick={checkNow} disabled={checking}
          className="mt-4 h-9 px-4 rounded-md bg-white text-[#152540] text-sm font-semibold inline-flex items-center gap-2 transition-colors hover:bg-[#f3f6fa] disabled:opacity-70">
          <Icon name="refresh" size={15} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking' : 'Check again'}
        </button>
      )}
    </div>
  )
}

export default function Landing({ pending = false }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh bg-canvas">
      <section className="bg-[#132238] auth-bg">
        <div className="max-w-5xl mx-auto px-6">
          <header className="h-20 flex items-center justify-between">
            <div className="flex items-center gap-3"><LogoMark size={36} onDark /><Wordmark inverted className="!text-xl" /></div>
            {pending ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-2 text-sm text-[#e4eaf3]">
                  <Avatar person={profile} size="xs" />{profile?.name}
                </span>
                <button onClick={signOut}
                  className="h-9 px-3.5 rounded-md text-sm font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/10">
                  Sign out
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="text-sm font-medium text-[#e4eaf3] hover:text-white">Sign in</button>
            )}
          </header>

          <div className="py-20 sm:py-28 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-accent-500 mb-5">Daily work tracking</p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.1]">
              Daily work, clearly logged.<br />Productivity, clearly reported.
            </h1>
            <p className="mt-6 text-lg text-[#c8d4e6] leading-relaxed">
              StrideLog replaces scattered status messages with one simple daily log, and gives managers an honest view of
              how work is progressing across the team.
            </p>
            {pending ? <AccessStatus /> : (
              <div className="mt-10 flex items-center gap-4">
                <button onClick={() => navigate('/login')}
                  className="h-11 px-6 rounded-md bg-[#ffffff] text-[#152540] text-[15px] font-semibold hover:bg-[#f3f6fa] transition-colors">
                  Sign in to your workspace
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map(f => (
          <div key={f.title} className="bg-surface border border-gray-200 rounded-lg p-6">
            <span className="w-10 h-10 rounded-md bg-primary-50 text-primary-700 flex items-center justify-center mb-4"><Icon name={f.icon} /></span>
            <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-xs text-gray-500">
        StrideLog. Daily work tracking for teams.
      </footer>
    </div>
  )
}
