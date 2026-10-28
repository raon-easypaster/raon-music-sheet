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

// 작업 공간의 모든 곡에서 주제 이름 바꾸기 (to가 ''이면 그 주제를 뺀다)
export function renameTheme(team, from, to) {
  return apiFetch('/songs/themes/rename', { method: 'POST', body: JSON.stringify({ team: team || null, from, to }) })
}
