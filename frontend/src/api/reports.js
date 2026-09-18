import { getAccessToken } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

// SECURITY FIX (Sensitive Tokens Stored in localStorage — see
// SECURITY.md #5): this used to read the access token from localStorage,
// which any script running on the page (e.g. via XSS) can read, turning a
// single injection bug into full session theft. The access token now
// lives only in memory (see api/client.js) and is never persisted to
// localStorage/sessionStorage.
function getAuthHeaders() {
  const access = getAccessToken()
  return access ? { Authorization: `Bearer ${access}` } : {}
}

function queryString(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

async function downloadReport(endpoint, filename, params = {}) {
  const res = await fetch(`${API_BASE}/reports/${endpoint}${queryString(params)}`, {
    method: 'GET',
    // SECURITY FIX (see SECURITY.md #5): send the httpOnly refresh-token
    // cookie along with every request, matching the rest of the app.
    credentials: 'include',
    headers: { ...getAuthHeaders() },
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.error?.message || `Report download failed (${res.status})`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadInventoryReport(params = {}) {
  const date = new Date().toISOString().slice(0, 10)
  return downloadReport('inventory', `inventory-report-${date}.pdf`, params)
}

export function downloadOrdersReport(params = {}) {
  const date = new Date().toISOString().slice(0, 10)
  return downloadReport('orders', `orders-report-${date}.pdf`, params)
}

export function downloadUsersReport() {
  const date = new Date().toISOString().slice(0, 10)
  return downloadReport('users', `users-report-${date}.pdf`)
}

export function downloadRequestsReport(params = {}) {
  const date = new Date().toISOString().slice(0, 10)
  return downloadReport('requests', `requests-report-${date}.pdf`, params)
}
