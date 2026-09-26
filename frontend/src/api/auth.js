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

export function logoutRequest(refreshToken) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    skipAuth: true,
  })
}

export function refreshTokens(refreshToken) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    skipAuth: true,
  })
}
