const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiClientError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// SECURITY FIX (Sensitive Tokens Stored in localStorage — see
// SECURITY.md #5): the access token used to be persisted to
// `localStorage.accessToken` and the refresh token to
// `localStorage.refreshToken`. Anything written to localStorage is
// readable by any JavaScript running on the page, so a single XSS bug
// (in this app or in any of its dependencies) would let an attacker read
// both tokens and mint themselves a persistent session.
//
// The refresh token no longer reaches the browser's JavaScript at all — the
// backend sets it as an httpOnly cookie (see auth.controller.ts), which is
// automatically attached to same-origin requests made with
// `credentials: 'include'` below, and simply cannot be read by `document`/
// `localStorage`/any script.
//
// The (short-lived, 15-minute) access token is still visible to JS because
// it has to be — it's sent as an Authorization header — but it now only
// ever lives in this module-level variable, never in Storage. It's wiped
// from memory on every full page reload, which is why AuthProvider calls
// `/auth/refresh` once on mount to silently re-establish it from the
// httpOnly cookie.
let inMemoryAccessToken = null

export function setAccessToken(token) {
  inMemoryAccessToken = token
}

export function getAccessToken() {
  return inMemoryAccessToken
}

/** Tracks whether a token refresh is already in flight */
let isRefreshing = false

/** Callbacks waiting for the in-flight refresh to settle */
let refreshQueue = []

function processQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  refreshQueue = []
}

async function attemptRefresh() {
  // No body needed — the refresh token travels via the httpOnly cookie,
  // sent automatically because of `credentials: 'include'`.
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiClientError('Session expired. Please log in again.', { status: 401 })
  }

  const { accessToken } = json.data
  setAccessToken(accessToken)
  return accessToken
}

async function retryRequest(path, method, headers, body, rest, newToken) {
  const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: retryHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    ...rest,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiClientError(json?.error?.message || res.statusText || 'Request failed', {
      status: res.status,
      code: json?.error?.code,
      details: json?.error?.details,
    })
  }
  return json
}

/**
 * @param {string} path - e.g. `/auth/login` (API_BASE should already include `/api` if needed)
 * @param {RequestInit & { body?: object, skipAuth?: boolean }} options
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, skipAuth = false, headers: extraHeaders, ...rest } =
    options
  const headers = { 'Content-Type': 'application/json', ...extraHeaders }

  if (!skipAuth) {
    const access = getAccessToken()
    if (access) headers.Authorization = `Bearer ${access}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Always send the httpOnly refresh-token cookie on same-site requests
    // (safe to include even on requests that don't need it).
    credentials: 'include',
    ...rest,
  })

  if (res.status === 401 && !skipAuth) {
    if (isRefreshing) {
      // Park this request until the in-flight refresh resolves
      const newToken = await new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      })
      return retryRequest(path, method, headers, body, rest, newToken)
    }

    isRefreshing = true
    try {
      const newToken = await attemptRefresh()
      processQueue(null, newToken)
      return retryRequest(path, method, headers, body, rest, newToken)
    } catch (err) {
      processQueue(err)
      setAccessToken(null)
      localStorage.removeItem('mts_user')
      // Signal AuthProvider to clear its React state
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'))
      throw err instanceof ApiClientError
        ? err
        : new ApiClientError('Session expired. Please log in again.', { status: 401 })
    } finally {
      isRefreshing = false
    }
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Request failed'
    throw new ApiClientError(msg, {
      status: res.status,
      code: json?.error?.code,
      details: json?.error?.details,
    })
  }
  return json
}
