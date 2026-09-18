import { apiRequest } from './client'

export function register(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  })
}

export function login(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  })
}

// SECURITY FIX (see SECURITY.md #5): logout/refresh no longer take a
// refreshToken argument — it now travels as an httpOnly cookie the browser
// attaches automatically (apiRequest always sends `credentials: 'include'`),
// rather than being read out of localStorage by this code.
export function logoutRequest() {
  return apiRequest('/auth/logout', {
    method: 'POST',
    skipAuth: true,
  })
}

export function refreshTokens() {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    skipAuth: true,
  })
}
