import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { setAccessToken } from '../api/client'
import { AuthContext } from './authContext'

// SECURITY FIX (Sensitive Tokens Stored in localStorage — see
// SECURITY.md #5): only the non-sensitive user *profile* (name/email/role —
// nothing an attacker could use as a credential) is cached here now, purely
// so the UI has something to render immediately on load. The access token
// lives in memory only (api/client.js) and the refresh token never reaches
// JS at all (httpOnly cookie). Losing the localStorage cache would just mean
// a brief loading flash, never a session compromise.
const STORAGE_USER = 'mts_user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)
  // True until the initial silent-refresh-from-cookie attempt (below)
  // settles, so ProtectedRoute doesn't redirect to /login while a valid
  // httpOnly-cookie session is still being restored after a page reload.
  const [isInitializing, setIsInitializing] = useState(true)

  const persistSession = useCallback((nextUser, accessToken) => {
    setUser(nextUser)
    localStorage.setItem(STORAGE_USER, JSON.stringify(nextUser))
    setAccessToken(accessToken)
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_USER)
    setAccessToken(null)
  }, [])

  const login = useCallback(
    async ({ email, password }) => {
      const res = await authApi.login({ email, password })
      const { user: u, accessToken } = res.data
      persistSession(u, accessToken)
      return u
    },
    [persistSession]
  )

  const register = useCallback(
    async (payload) => {
      const body = { ...payload }
      if (!body.phone?.trim()) delete body.phone
      const res = await authApi.register(body)
      const { user: u, accessToken } = res.data
      persistSession(u, accessToken)
      return u
    },
    [persistSession]
  )

  /**
   * New feature: Sign in with Google. Called by GoogleOAuthCallbackPage once
   * it has the authorization code from Google — see SECURITY.md
   * "New Feature: Sign in with Google".
   */
  const loginWithGoogle = useCallback(
    async ({ code, redirectUri }) => {
      const res = await authApi.googleLogin({ code, redirectUri })
      const { user: u, accessToken } = res.data
      persistSession(u, accessToken)
      return u
    },
    [persistSession]
  )

  useEffect(() => {
    const handler = () => clearSession()
    window.addEventListener('auth:sessionExpired', handler)
    return () => window.removeEventListener('auth:sessionExpired', handler)
  }, [clearSession])

  // On first mount (including every full page reload, which wipes the
  // in-memory access token), try to silently re-establish the session from
  // the httpOnly refresh-token cookie, exactly the way a returning user
  // would expect "staying logged in" to work.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const res = await authApi.refreshTokens()
        if (cancelled) return
        setAccessToken(res.data.accessToken)
        // We didn't get user data back from /auth/refresh (it only issues
        // tokens), so keep whatever profile was cached locally; if there
        // was none (e.g. cookies-only session on a new device) the user
        // will simply be treated as logged out until they sign in again.
      } catch {
        if (cancelled) return
        clearSession()
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logoutRequest()
    } catch {
      // Still clear local session if server unreachable
    }
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      register,
      loginWithGoogle,
      logout,
    }),
    [user, isInitializing, login, register, loginWithGoogle, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
