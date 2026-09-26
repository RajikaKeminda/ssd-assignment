import { apiRequest } from './client'

function queryString(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function listPharmacies(params = {}) {
  const res = await apiRequest(`/pharmacies${queryString(params)}`, { skipAuth: true })
  return res.data
}

export async function getPharmacy(id) {
  const res = await apiRequest(`/pharmacies/${id}`, { skipAuth: true })
  return res.data
}

export async function createPharmacy(body) {
  const res = await apiRequest('/pharmacies', { method: 'POST', body })
  return res.data
}

export async function updatePharmacy(id, body) {
  const res = await apiRequest(`/pharmacies/${id}`, { method: 'PUT', body })
  return res.data
}

export async function deactivatePharmacy(id) {
  const res = await apiRequest(`/pharmacies/${id}`, { method: 'DELETE' })
  return res.data
}

export async function verifyPharmacy(id) {
  const res = await apiRequest(`/pharmacies/${id}/verify`, { method: 'PATCH' })
  return res.data
}

export async function getNearbyPharmacies(params) {
  const res = await apiRequest(`/pharmacies/nearby${queryString(params)}`, { skipAuth: true })
  return res.data
}

export async function listPharmacyReviews(id, params = {}) {
  const res = await apiRequest(`/pharmacies/${id}/reviews${queryString(params)}`, { skipAuth: true })
  return res.data
}

export async function createPharmacyReview(id, body) {
  const res = await apiRequest(`/pharmacies/${id}/reviews`, { method: 'POST', body })
  return res.data
}
