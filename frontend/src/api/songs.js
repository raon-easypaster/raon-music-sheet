import { apiFetch } from './client'

export function getSongs() {
  return apiFetch('/songs')
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

export function deleteSong(id) {
  return apiFetch(`/songs/${id}`, { method: 'DELETE' })
}
