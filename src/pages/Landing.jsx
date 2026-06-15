import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-600 to-primary-400 relative overflow-hidden flex items-center">
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-white font-black text-lg">S</span>
              </div>
              <span className="text-white font-bold text-lg">StrideLog</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-5">
              Your team's work,<br />finally visible.
            </h1>
            <p className="text-purple-200 text-lg mb-8 leading-relaxed">
              Replace your WhatsApp work updates with a beautiful, searchable, insightful daily log. Track progress, spot blockers, celebrate streaks.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-6 py-3 rounded-xl hover:bg-purple-50 transition-colors shadow-xl text-base"
            >
              Sign in to your workspace →
            </button>
          </div>

          {/* Mock dashboard preview */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-2xl shadow-2xl p-6 rotate-2 max-w-sm">
              <p className="text-xs font-semibold text-primary-600 mb-3">Good morning, Vishvajit 👋</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[['24', 'Tasks done'], ['🔥 7', 'Day streak'], ['92%', 'Completion']].map(([val, label]) => (
                  <div key={label} className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="font-black text-primary-600 text-xl">{val}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-primary-600 mb-2">LAST 7 DAYS</p>
                <div className="flex items-end gap-1 h-8">
                  {[70, 100, 40, 85, 90, 30, 60].map((h, i) => (
                    <div key={i} className="flex-1 bg-primary-400 rounded-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '✎', title: 'Log your day in 2 minutes', desc: 'Add tasks with status, categories, and standup notes. No long forms, no fuss.' },
            { icon: '🔥', title: 'Track your streak & growth', desc: 'See your consistency streak, completion rate, and monthly activity heatmap.' },
            { icon: '◉', title: 'Admin sees the whole team', desc: "Know who's active, who's missing, and read any member's history at a glance." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="text-center p-6">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-600 text-xl">{icon}</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-purple-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              ['1', 'Admin creates your account', 'No self-signup — your admin adds you and sends credentials.'],
              ['2', 'Log daily tasks + notes', 'Takes 2 minutes. Tasks, status, standup sections. Done.'],
              ['3', 'Watch your growth', 'Streaks, completion rates, and history — all tracked automatically.'],
            ].map(([num, title, desc]) => (
              <div key={num} className="bg-white rounded-xl p-6 shadow-sm border border-primary-100">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold text-sm">{num}</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 text-sm">{title}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center border-t border-gray-100">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
            <span className="text-white font-black text-xs">S</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">StrideLog</span>
        </div>
        <p className="text-gray-400 text-xs">Built for teams who value their work.</p>
      </footer>
    </div>
  )
}
