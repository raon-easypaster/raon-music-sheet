import { apiFetch } from './client'

export function getSongs(team) {
  return apiFetch(team ? `/songs?team=${team}` : '/songs')
}

export function getSongById(id) {
  return apiFetch(`/songs/${id}`)
}

export function createSong(payload) {
  return apiFetch('/songs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSong(id, payload) {
  return apiFetch(`/songs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function setFavorite(id, favorite) {
  return apiFetch(`/songs/${id}/favorite`, {
    method: 'PUT',
    body: JSON.stringify({ favorite }),
  })
}

export function deleteSong(id) {
  return apiFetch(`/songs/${id}`, { method: 'DELETE' })
}
