import { apiFetch } from './client'

export function loginRequest(payload) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function signupRequest(payload) {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function changePasswordRequest(payload) {
  return apiFetch('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}