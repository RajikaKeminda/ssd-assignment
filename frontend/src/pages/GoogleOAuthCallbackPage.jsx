import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import { GOOGLE_REDIRECT_URI, consumeGoogleOAuthState } from '../utils/googleOAuth'

/**
 * New feature: Sign in with Google — the OAuth redirect target.
 * See SECURITY.md "New Feature: Sign in with Google".
 *
 * Google redirects the browser here with `?code=...&state=...` after the
 * user approves consent. This page verifies `state` (CSRF check), then
 * POSTs the code to the backend (which is the only party that holds the
 * client secret needed to actually redeem it), and finally establishes the
 * app session exactly like a password login would.
 */
export function GoogleOAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ranOnce = useRef(false)

  useEffect(() => {
    // Authorization codes are single-use — React StrictMode/dev double-
    // invocation would otherwise burn the code on a harmless duplicate call.
    if (ranOnce.current) return
    ranOnce.current = true

    async function run() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const oauthError = searchParams.get('error')

      if (oauthError) {
        setError('Google sign-in was cancelled or denied.')
        return
      }

      if (!code || !consumeGoogleOAuthState(state)) {
        setError('Invalid or expired Google sign-in request. Please try again.')
        return
      }

      try {
        await loginWithGoogle({ code, redirectUri: GOOGLE_REDIRECT_URI })
        navigate('/', { replace: true })
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not complete Google sign-in. Please try again.'
        )
      }
    }

    run()
  }, [searchParams, loginWithGoogle, navigate])

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      {error ? (
        <div className="max-w-sm">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block font-semibold text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">Signing you in with Google…</p>
      )}
    </div>
  )
}
