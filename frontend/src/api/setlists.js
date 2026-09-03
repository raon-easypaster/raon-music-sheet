import { apiFetch } from './client'

export function getSetlists() {
  return apiFetch('/setlists')
}

export function createSetlist(payload) {
  return apiFetch('/setlists', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function addSongsToSetlist(id, songIds) {
  return apiFetch(`/setlists/${id}/songs`, {
    method: 'PUT',
    body: JSON.stringify({ songIds }),
  })
}

export function removeSongFromSetlist(id, songId) {
  return apiFetch(`/setlists/${id}/remove-song`, {
    method: 'PUT',
    body: JSON.stringify({ songId }),
  })
}

export function reorderSetlist(id, songIds) {
  return apiFetch(`/setlists/${id}/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ songIds }),
  })
}

export function generateShareToken(id) {
  return apiFetch(`/setlists/${id}/share`, { method: 'POST' })
}

export function getPublicSetlist(token) {
  return apiFetch(`/setlists/public/${token}`, { skipAuth: true })
}

export function deleteSetlist(id) {
  return apiFetch(`/setlists/${id}`, {
    method: 'DELETE',
  })
}
