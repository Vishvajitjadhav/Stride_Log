import { useAuth } from '../contexts/AuthContext'

export default function PendingApproval() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-600 to-primary-400 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-black text-lg">S</span>
          </div>
          <span className="text-white font-bold text-xl">StrideLog</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-3">
          <p className="text-4xl">⏳</p>
          <h2 className="text-xl font-bold text-gray-900">Waiting for approval</h2>
          <p className="text-sm text-gray-500">
            Thanks for signing up{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}! Your account is pending
            approval from an admin. You'll be able to log your work as soon as you're approved.
          </p>
          <button
            onClick={signOut}
            className="mt-2 text-sm text-primary-600 font-medium hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
