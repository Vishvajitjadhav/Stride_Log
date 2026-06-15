import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'

// Where the password-reset email link lands. supabase-js has already turned the
// link into a recovery session by the time this renders, so we just collect a
// new password and call updateUser.
export default function ResetPassword() {
  const { updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) setError(error.message || 'Could not update password.')
    else setDone(true)
  }

  async function backToSignIn() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-600 to-primary-400 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-black text-lg">S</span>
          </div>
          <span className="text-white font-bold text-xl">StrideLog</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center space-y-3">
              <p className="text-4xl">✅</p>
              <h2 className="text-xl font-bold text-gray-900">Password updated</h2>
              <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
              <button onClick={backToSignIn}
                className="mt-2 w-full bg-primary-600 text-white font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
                Go to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h2>
              <p className="text-sm text-gray-400 mb-6">Choose a password you'll remember.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="New password" type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={6} autoFocus />
                <Input label="Confirm password" type="password" placeholder="••••••••" value={confirm}
                  onChange={e => setConfirm(e.target.value)} required minLength={6} />
                {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50">
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
