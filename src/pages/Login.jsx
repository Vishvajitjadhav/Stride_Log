import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'

const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_AUTH === 'true'
const MICROSOFT_ENABLED = import.meta.env.VITE_MICROSOFT_AUTH === 'true'

function ProviderButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 bg-surface text-sm font-medium text-gray-700
        hover:bg-gray-50 hover:border-gray-300 active:scale-[.99] transition-all"
    >
      {children}
    </button>
  )
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <path fill="#F25022" d="M0 0h10v10H0z" /><path fill="#7FBA00" d="M11 0h10v10H11z" />
      <path fill="#00A4EF" d="M0 11h10v10H0z" /><path fill="#FFB900" d="M11 11h10v10H11z" />
    </svg>
  )
}

function GoogleLogo() {
  return (
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"/>
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/>
      </svg>
  )
}

export default function Login() {
  const { signIn, signUp, signInWithProvider, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setNotice(''); setLoading(true)

    if (isForgot) {
      const { error } = await resetPassword(email)
      setLoading(false)
      if (error) setError(error.message || 'Could not send reset email.')
      else setNotice('Check your email for a link to reset your password.')
      return
    }

    if (isSignup) {
      const { data, error } = await signUp(email, password, name)
      setLoading(false)
      if (error) setError(error.message || 'Could not create account.')
      else if (!data.session) setNotice('Check your email to confirm your address, then sign in.')
      else navigate('/') // home page for the role (or the pending screen)
      return
    }

    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(/confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox.' : 'Invalid email or password.')
    else navigate('/')
  }

  async function handleProvider(provider) {
    setError('')
    const { error } = await signInWithProvider(provider)
    if (error) setError(error.message || 'Sign in failed. Please try again.')
  }

  function go(next) {
    setMode(next); setError(''); setNotice('')
  }

  const heading = isForgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Welcome back'
  const sub = isForgot
    ? "We'll email you a reset link"
    : isSignup ? 'An admin will approve your access' : 'Sign in to your workspace'

  return (
    <div className="min-h-dvh auth-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandMark />
        </div>

        <div className="card !rounded-3xl !shadow-[0_24px_60px_-24px_rgb(79_76_227/.35)] rise p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-1">{heading}</h2>
          <p className="text-sm text-gray-500 mb-6">{sub}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <Input label="Full name" type="text" placeholder="Jane Doe" value={name}
                onChange={e => setName(e.target.value)} required autoFocus />
            )}
            <Input label="Email" type="email" placeholder="you@company.com" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus={!isSignup} />
            {!isForgot && (
              <Input label="Password" type="password" placeholder="••••••••" value={password}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                onChange={e => setPassword(e.target.value)} required minLength={isSignup ? 8 : 6} />
            )}

            {!isForgot && !isSignup && (
              <div className="text-right -mt-1">
                <button type="button" onClick={() => go('forgot')} className="text-xs text-primary-600 hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {notice && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{notice}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-b from-[#6c6af0] to-brand text-white font-semibold py-3 rounded-xl shadow-[0_8px_20px_-8px_rgb(79_76_227/.6)] hover:from-primary-600 hover:to-primary-700 active:scale-[.99] transition-all disabled:opacity-50">
              {loading ? 'Please wait' : isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {(MICROSOFT_ENABLED || GOOGLE_ENABLED) && !isForgot && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-gray-100 flex-1" />
                <span className="text-xs text-gray-300">or</span>
                <div className="h-px bg-gray-100 flex-1" />
              </div>
              <div className="space-y-2">
                {MICROSOFT_ENABLED && (
                  <ProviderButton onClick={() => handleProvider('azure')}><MicrosoftLogo /> Continue with Microsoft</ProviderButton>
                )}
                {GOOGLE_ENABLED && (
                  <ProviderButton onClick={() => handleProvider('google')}><GoogleLogo /> Continue with Google</ProviderButton>
                )}
              </div>
              {MICROSOFT_ENABLED && (
                <p className="text-[11px] text-gray-400 text-center mt-3">Use your company account. Teams and Jira sync use the same email.</p>
              )}
            </>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          {isForgot ? (
            <button onClick={() => go('signin')} className="text-primary-600 font-semibold hover:underline">
              Back to sign in
            </button>
          ) : (
            <>
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={() => go(isSignup ? 'signin' : 'signup')} className="text-primary-600 font-semibold hover:underline">
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
