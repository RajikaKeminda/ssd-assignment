// New feature: Sign in with Google — OAuth 2.0 / OpenID Connect
// Authorization Code grant (see SECURITY.md "New Feature: Sign in with
// Google"). This module only ever handles the PUBLIC client id and the
// authorization `code` Google hands back — the client *secret* used to
// redeem that code lives exclusively on the backend
// (backend/src/services/oauth.service.ts), which is the whole point of
// using the Authorization Code grant instead of the implicit flow.

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const STATE_STORAGE_KEY = 'mts_oauth_state'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
export const GOOGLE_REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_REDIRECT_URI ??
  `${window.location.origin}/oauth/google/callback`

export function isGoogleSignInConfigured() {
  return Boolean(GOOGLE_CLIENT_ID)
}

/**
 * Redirects the browser to Google's consent screen. A random `state` value
 * is generated and stashed in sessionStorage so the callback page can
 * confirm the response actually corresponds to a request this tab made
 * (basic CSRF protection for the OAuth flow).
 */
export function startGoogleSignIn() {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_STORAGE_KEY, state)

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  })

  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`)
}

/**
 * Validates the `state` query param the callback page received against the
 * one stashed by startGoogleSignIn(), then clears it (single use).
 */
export function consumeGoogleOAuthState(receivedState) {
  const expected = sessionStorage.getItem(STATE_STORAGE_KEY)
  sessionStorage.removeItem(STATE_STORAGE_KEY)
  return Boolean(expected) && expected === receivedState
}
