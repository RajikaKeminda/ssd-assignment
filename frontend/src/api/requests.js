import { apiRequest } from './client'

function queryString(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function createRequest(body) {
  const res = await apiRequest('/requests', { method: 'POST', body })
  return res.data
}

export async function getRequest(id) {
  const res = await apiRequest(`/requests/${id}`)
  return res.data
}

export async function updateRequest(id, body) {
  const res = await apiRequest(`/requests/${id}`, { method: 'PUT', body })
  return res.data
}

export async function updateRequestStatus(id, body) {
  const res = await apiRequest(`/requests/${id}/status`, { method: 'PATCH', body })
  return res.data
}

export async function cancelRequest(id) {
  const res = await apiRequest(`/requests/${id}`, { method: 'DELETE' })
  return res.data
}

/** Admin / pharmacy staff (global queue) */
export async function listRequests(filters = {}) {
  const res = await apiRequest(`/requests${queryString(filters)}`)
  return res.data
}

export async function listUrgentRequests(pagination = {}) {
  const res = await apiRequest(`/requests/urgent${queryString(pagination)}`)
  return res.data
}

export async function listUserRequests(userId, pagination = {}) {
  const res = await apiRequest(`/requests/user/${userId}${queryString(pagination)}`)
  return res.data
}

export async function listPharmacyRequests(pharmacyId, pagination = {}) {
  const res = await apiRequest(`/requests/pharmacy/${pharmacyId}${queryString(pagination)}`)
  return res.data
}
