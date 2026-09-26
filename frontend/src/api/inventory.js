import { apiRequest } from './client'

function queryString(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function listInventory(params = {}) {
  const res = await apiRequest(`/inventory${queryString(params)}`)
  return res.data
}

export async function getInventoryItem(id) {
  const res = await apiRequest(`/inventory/${id}`)
  return res.data
}

export async function createInventoryItem(body) {
  const res = await apiRequest('/inventory', { method: 'POST', body })
  return res.data
}

export async function updateInventoryItem(id, body) {
  const res = await apiRequest(`/inventory/${id}`, { method: 'PUT', body })
  return res.data
}

export async function deleteInventoryItem(id) {
  const res = await apiRequest(`/inventory/${id}`, { method: 'DELETE' })
  return res.data
}

export async function getLowStock(params = {}) {
  const res = await apiRequest(`/inventory/low-stock${queryString(params)}`)
  return res.data
}

export async function getExpiring(params = {}) {
  const res = await apiRequest(`/inventory/expiring${queryString(params)}`)
  return res.data
}
