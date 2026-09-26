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
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    throw new ApiClientError('No refresh token available', { status: 401 })
  }

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiClientError('Session expired. Please log in again.', { status: 401 })
  }

  const { accessToken, refreshToken: newRefreshToken } = json.data
  localStorage.setItem('accessToken', accessToken)
  if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken)
  return accessToken
}

async function retryRequest(path, method, headers, body, rest, newToken) {
  const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: retryHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    const access = localStorage.getItem('accessToken')
    if (access) headers.Authorization = `Bearer ${access}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
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
