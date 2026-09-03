import { apiFetch } from './client'

export function getMyTeams() {
  return apiFetch('/teams')
}

export function createTeam(payload) {
  return apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function joinTeam(inviteCode) {
  return apiFetch('/teams/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  })
}

export function leaveTeam(id) {
  return apiFetch(`/teams/${id}/leave`, { method: 'DELETE' })
}

export function deleteTeam(id) {
  return apiFetch(`/teams/${id}`, { method: 'DELETE' })
}
