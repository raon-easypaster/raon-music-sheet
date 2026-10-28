import { apiFetch } from './client'

export function getSetlists(team) {
  return apiFetch(team ? `/setlists?team=${team}` : '/setlists')
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

const pinHeader = (pin) => (pin ? { 'x-share-pin': pin } : {})

export function getPublicSetlist(token, pin) {
  return apiFetch(`/setlists/public/${token}`, { skipAuth: true, headers: pinHeader(pin) })
}

export function getPublicCurrentSong(token) {
  return apiFetch(`/setlists/public/${token}/current`, { skipAuth: true })
}

export function setPublicCurrentSong(token, index, pin) {
  return apiFetch(`/setlists/public/${token}/current`, {
    method: 'PUT',
    skipAuth: true,
    headers: pinHeader(pin),
    body: JSON.stringify({ index }),
  })
}

export function deleteSetlist(id) {
  return apiFetch(`/setlists/${id}`, {
    method: 'DELETE',
  })
}

export function updateSetlist(id, payload) {
  return apiFetch(`/setlists/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function duplicateSetlist(id, payload) {
  return apiFetch(`/setlists/${id}/duplicate`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateSongSettings(id, songId, payload) {
  return apiFetch(`/setlists/${id}/song-settings/${songId}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function setSharePin(id, pin) {
  return apiFetch(`/setlists/${id}/share-pin`, { method: 'PUT', body: JSON.stringify({ pin }) })
}

export function setCurrentSong(id, index) {
  return apiFetch(`/setlists/${id}/current`, { method: 'PUT', body: JSON.stringify({ index }) })
}

export function updateSetlistItems(id, items) {
  return apiFetch(`/setlists/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) })
}

const teamQuery = (team) => (team ? `?team=${team}` : '')

export function getTemplates(team) {
  return apiFetch(`/setlists/templates${teamQuery(team)}`)
}

export function createTemplate(fromSetlist, name) {
  return apiFetch('/setlists/templates', { method: 'POST', body: JSON.stringify({ fromSetlist, name }) })
}

export function deleteTemplate(id) {
  return apiFetch(`/setlists/templates/${id}`, { method: 'DELETE' })
}
