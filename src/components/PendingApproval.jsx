import { useEffect } from 'react'
import BrandMark from './BrandMark'
import { useAuth } from '../contexts/AuthContext'

export default function PendingApproval() {
  const { profile, signOut, refreshProfile } = useAuth()
  const inactive = profile?.is_active === false

  // Re-check every 20s so the app opens as soon as HR/admin approves.
  useEffect(() => {
    if (inactive) return
    const t = setInterval(refreshProfile, 20_000)
    return () => clearInterval(t)
  }, [inactive, refreshProfile])

  return (
    <div className="min-h-dvh bg-gradient-to-br from-primary-900 via-primary-600 to-primary-400 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-8">
          <BrandMark inverted />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-3">
          <p className="text-4xl">{inactive ? '🔒' : '⏳'}</p>
          <h2 className="text-xl font-bold text-gray-900">{inactive ? 'Account deactivated' : 'Waiting for approval'}</h2>
          <p className="text-sm text-gray-500">
            {inactive
              ? 'Your access has been turned off. Contact HR or your admin if you think this is a mistake.'
              : <>Thanks for signing up{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}! HR or an admin will approve your
                account shortly — you'll get an email, and this page opens automatically.</>}
          </p>
          <button onClick={signOut} className="mt-2 text-sm text-primary-600 font-medium hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
