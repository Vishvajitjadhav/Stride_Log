import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { can as canDo } from '../lib/permissions'

const AuthContext = createContext(null)

const PROFILE_KEY = 'stridelog:profile'
const cachedProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) } catch { return null } }
const cacheProfile = p => { try { p ? localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) : localStorage.removeItem(PROFILE_KEY) } catch { /* storage unavailable */ } }

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = initialising
  const [profile, setProfile] = useState(null)
  const [recovering, setRecovering] = useState(false)

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) { setProfile(data); cacheProfile(data) }
  }, [])

  useEffect(() => {
    // INITIAL_SESSION fires once on subscribe, so no separate getSession call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // The reset-password email link signs the user in with a recovery
      // session; keep them on the "set new password" screen.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(session ?? null)
      if (!session) { setProfile(null); cacheProfile(null); return }
      if (event === 'TOKEN_REFRESHED') return

      // Show the cached profile instantly (no splash for returning users),
      // then refresh it in the background.
      const cached = cachedProfile()
      if (cached?.id === session.user.id) setProfile(p => p ?? cached)
      // Defer: calling Supabase inside this callback can deadlock the auth lock.
      setTimeout(() => fetchProfile(session.user.id), 0)
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password, name) {
    return supabase.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
    })
  }

  // 'google' or 'azure' (Microsoft work account, same email as Teams and Jira).
  async function signInWithProvider(provider) {
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/`, ...(provider === 'azure' && { scopes: 'email openid profile' }) },
    })
  }

  // Sends a password-reset email; the link opens /reset-password in the app.
  async function resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  }

  async function updatePassword(password) {
    const res = await supabase.auth.updateUser({ password })
    if (!res.error) setRecovering(false)
    return res
  }

  async function updateProfile(fields) {
    const { data, error } = await supabase
      .from('profiles').update(fields).eq('id', session.user.id).select().single()
    if (!error) { setProfile(data); cacheProfile(data) }
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role
  const can = useCallback(action => canDo(profile, action), [profile])

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      profile,
      isLoading: session === undefined,
      role,
      can,
      isAdmin: role === 'admin',
      // profile may briefly be null right after sign-in; treat unknown as not-yet-approved
      isApproved: profile?.is_approved === true && profile?.is_active !== false,
      profileLoaded: profile !== null,
      recovering,
      signIn,
      signUp,
      signInWithProvider,
      resetPassword,
      updatePassword,
      updateProfile,
      refreshProfile: () => session && fetchProfile(session.user.id),
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
