const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

function getAuthHeaders() {
  const access = localStorage.getItem('accessToken')
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
