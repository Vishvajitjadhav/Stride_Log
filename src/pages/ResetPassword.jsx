import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'

// Landing page for both the "reset password" email and the "you're invited"
// email. supabase-js turns the link into a session before this renders, so we
// only collect a new password and call updateUser.
export default function ResetPassword() {
  const { session, isLoading, updatePassword, profile } = useAuth()
  const temporary = profile?.must_change_password
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Expired / already-used links come back with an error in the URL hash.
  const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) setError(error.message || 'Could not update password.')
    else setDone(true)
  }

  const invalid = !isLoading && !session

  return (
    <div className="min-h-dvh auth-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandMark />
        </div>

        <div className="card !rounded-3xl !shadow-[0_24px_60px_-24px_rgb(79_76_227/.35)] rise p-6 sm:p-8">
          {done ? (
            <div className="text-center space-y-3">
              <h2 className="text-xl font-bold text-gray-900">Password saved</h2>
              <p className="text-sm text-gray-500">You're signed in and ready to go.</p>
              <button onClick={() => navigate('/', { replace: true })}
                className="mt-2 w-full bg-gradient-to-b from-[#6c6af0] to-brand text-white font-semibold py-3 rounded-xl shadow-[0_8px_20px_-8px_rgb(79_76_227/.6)] hover:from-primary-600 hover:to-primary-700 active:scale-[.99] transition-all">
                Continue
              </button>
            </div>
          ) : invalid ? (
            <div className="text-center space-y-3">
              <h2 className="text-xl font-bold text-gray-900">Link expired</h2>
              <p className="text-sm text-gray-500">{linkError || 'This link is invalid or has already been used.'} Request a new one from the sign in page.</p>
              <button onClick={() => navigate('/login', { replace: true })}
                className="mt-2 w-full bg-gradient-to-b from-[#6c6af0] to-brand text-white font-semibold py-3 rounded-xl shadow-[0_8px_20px_-8px_rgb(79_76_227/.6)] hover:from-primary-600 hover:to-primary-700 active:scale-[.99] transition-all">
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{temporary ? 'Choose your own password' : 'Set your password'}</h2>
              <p className="text-sm text-gray-500 mb-6">
                {temporary ? <>Replace the temporary password from your admin. Signed in as {session?.user?.email}.</> : session?.user?.email}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus />
                <Input label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm}
                  onChange={e => setConfirm(e.target.value)} required minLength={8} />
                {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-b from-[#6c6af0] to-brand text-white font-semibold py-3 rounded-xl shadow-[0_8px_20px_-8px_rgb(79_76_227/.6)] hover:from-primary-600 hover:to-primary-700 active:scale-[.99] transition-all disabled:opacity-50">
                  {loading ? 'Saving' : 'Save password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
