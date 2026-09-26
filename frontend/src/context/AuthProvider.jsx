import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { AuthContext } from './authContext'

const STORAGE_USER = 'mts_user'
const STORAGE_ACCESS = 'accessToken'
const STORAGE_REFRESH = 'refreshToken'

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

  const persistSession = useCallback((nextUser, accessToken, refreshToken) => {
    setUser(nextUser)
    localStorage.setItem(STORAGE_USER, JSON.stringify(nextUser))
    localStorage.setItem(STORAGE_ACCESS, accessToken)
    localStorage.setItem(STORAGE_REFRESH, refreshToken)
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_USER)
    localStorage.removeItem(STORAGE_ACCESS)
    localStorage.removeItem(STORAGE_REFRESH)
  }, [])

  const login = useCallback(
    async ({ email, password }) => {
      const res = await authApi.login({ email, password })
      const { user: u, accessToken, refreshToken } = res.data
      persistSession(u, accessToken, refreshToken)
      return u
    },
    [persistSession]
  )

  const register = useCallback(
    async (payload) => {
      const body = { ...payload }
      if (!body.phone?.trim()) delete body.phone
      const res = await authApi.register(body)
      const { user: u, accessToken, refreshToken } = res.data
      persistSession(u, accessToken, refreshToken)
      return u
    },
    [persistSession]
  )

  useEffect(() => {
    const handler = () => clearSession()
    window.addEventListener('auth:sessionExpired', handler)
    return () => window.removeEventListener('auth:sessionExpired', handler)
  }, [clearSession])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(STORAGE_REFRESH)
    try {
      if (refreshToken) await authApi.logoutRequest(refreshToken)
    } catch {
      // Still clear local session if server unreachable
    }
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
