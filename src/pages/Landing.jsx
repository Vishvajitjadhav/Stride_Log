import { useNavigate } from 'react-router-dom'
import { LogoMark, Wordmark } from '../components/Logo'
import Icon from '../components/ui/Icon'

const FEATURES = [
  { icon: 'today', title: 'Plan the day', text: 'Employees list their tasks, mark progress and submit the day in under a minute, on phone or desktop.' },
  { icon: 'team', title: 'See the whole team', text: 'Managers see who is working on what today, and every day of the week at a glance.' },
  { icon: 'analytics', title: 'Report with confidence', text: 'Clear weekly and monthly numbers, plain observations and detailed PDF reports for every employee.' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-[#f5f6f8]">
      <section className="bg-primary-900 auth-bg">
        <div className="max-w-5xl mx-auto px-6">
          <header className="h-20 flex items-center justify-between">
            <div className="flex items-center gap-3"><LogoMark size={36} onDark /><Wordmark inverted className="!text-xl" /></div>
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-primary-100 hover:text-white">Sign in</button>
          </header>

          <div className="py-20 sm:py-28 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-accent-500 mb-5">Daily work tracking</p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.1]">
              Daily work, clearly logged.<br />Productivity, clearly reported.
            </h1>
            <p className="mt-6 text-lg text-primary-200 leading-relaxed">
              StrideLog replaces scattered status messages with one simple daily log, and gives managers an honest view of
              how work is progressing across the team.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <button onClick={() => navigate('/login')}
                className="h-11 px-6 rounded-md bg-white text-primary-900 text-[15px] font-semibold hover:bg-primary-50 transition-colors">
                Sign in to your workspace
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map(f => (
          <div key={f.title} className="bg-white border border-gray-200 rounded-lg p-6">
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
