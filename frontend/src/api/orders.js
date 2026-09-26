import { apiRequest } from './client'

function queryString(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function createOrder(body) {
  const res = await apiRequest('/orders', { method: 'POST', body })
  return res.data
}

export async function listOrders(filters = {}) {
  const res = await apiRequest(`/orders${queryString(filters)}`)
  return res.data
}

export async function listUserOrders(userId, pagination = {}) {
  const res = await apiRequest(`/orders/user/${userId}${queryString(pagination)}`)
  return res.data
}

export async function listPharmacyOrders(pharmacyId, pagination = {}) {
  const res = await apiRequest(`/orders/pharmacy/${pharmacyId}${queryString(pagination)}`)
  return res.data
}

export async function listDeliveryPartnerOrders(partnerId, pagination = {}) {
  const res = await apiRequest(`/orders/delivery-partner/${partnerId}${queryString(pagination)}`)
  return res.data
}

export async function getOrder(id) {
  const res = await apiRequest(`/orders/${id}`)
  return res.data
}

export async function getDeliveryTracking(id) {
  const res = await apiRequest(`/orders/track/${id}`)
  return res.data
}

export async function updateOrder(id, body) {
  const res = await apiRequest(`/orders/${id}`, { method: 'PUT', body })
  return res.data
}

export async function updateOrderStatus(id, body) {
  const res = await apiRequest(`/orders/${id}/status`, { method: 'PATCH', body })
  return res.data
}

export async function processPayment(id, body) {
  const res = await apiRequest(`/orders/${id}/payment`, { method: 'POST', body })
  return res.data
}

export async function downloadInvoice(id, orderNumber) {
  const API_BASE = import.meta.env.VITE_API_URL ?? '/api'
  const access = localStorage.getItem('accessToken')

  const res = await fetch(`${API_BASE}/orders/${id}/invoice`, {
    method: 'GET',
    headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}) },
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.error?.message || `Invoice download failed (${res.status})`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-${orderNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function assignDeliveryPartner(id, body) {
  const res = await apiRequest(`/orders/${id}/assign-delivery`, { method: 'PATCH', body })
  return res.data
}

export async function cancelOrder(id, body = {}) {
  const res = await apiRequest(`/orders/${id}/cancel`, { method: 'PATCH', body })
  return res.data
}

export async function deleteOrder(id) {
  const res = await apiRequest(`/orders/${id}`, { method: 'DELETE' })
  return res.data
}
