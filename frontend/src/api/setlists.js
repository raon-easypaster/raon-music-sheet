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

// baseRevision: 화면이 보고 있던 콘티 판 번호. 그 사이 다른 사람이 고쳤으면 서버가 409로 막는다
export function addSongsToSetlist(id, songIds, baseRevision) {
  return apiFetch(`/setlists/${id}/songs`, {
    method: 'PUT',
    body: JSON.stringify({ songIds, baseRevision }),
  })
}

export function removeSongFromSetlist(id, songId, baseRevision) {
  return apiFetch(`/setlists/${id}/remove-song`, {
    method: 'PUT',
    body: JSON.stringify({ songId, baseRevision }),
  })
}

export function reorderSetlist(id, songIds, baseRevision) {
  return apiFetch(`/setlists/${id}/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ songIds, baseRevision }),
  })
}

export function generateShareToken(id) {
  return apiFetch(`/setlists/${id}/share`, { method: 'POST' })
}

const pinHeader = (pin) => (pin ? { 'x-share-pin': pin } : {})

export function getPublicSetlist(token, pin) {
  // 로그인한 팀원이면 로그인 정보를 함께 보낸다 (팀원 전용 링크가 열리고, 비밀번호도 필요 없다)
  return apiFetch(`/setlists/public/${token}`, { headers: pinHeader(pin) })
}

// 실시간 진행 상태. 로그인한 팀원이면 로그인 정보를 함께 보내 진행 권한을 받아 온다
export function getPublicCurrentSong(token) {
  return apiFetch(`/setlists/public/${token}/current`)
}

// 진행자만 성공한다 (공유 링크만으로는 403)
export function setPublicCurrentSong(token, index, { takeover = false } = {}) {
  return apiFetch(`/setlists/public/${token}/current`, {
    method: 'PUT',
    body: JSON.stringify({ index, takeover }),
  })
}

export function deleteSetlist(id) {
  return apiFetch(`/setlists/${id}`, {
    method: 'DELETE',
  })
}

export function updateSetlist(id, payload, baseRevision) {
  return apiFetch(`/setlists/${id}`, { method: 'PUT', body: JSON.stringify({ ...payload, baseRevision }) })
}

export function duplicateSetlist(id, payload) {
  return apiFetch(`/setlists/${id}/duplicate`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateSongSettings(id, songId, payload, baseRevision) {
  return apiFetch(`/setlists/${id}/song-settings/${songId}`, { method: 'PUT', body: JSON.stringify({ ...payload, baseRevision }) })
}

// 링크만으로 누구나 보게 열지(true), 팀원·비밀번호로만 열리게 잠글지(false)
export function setShareAccess(id, open) {
  return apiFetch(`/setlists/${id}/share-access`, { method: 'PUT', body: JSON.stringify({ open }) })
}

export function setSharePin(id, pin) {
  return apiFetch(`/setlists/${id}/share-pin`, { method: 'PUT', body: JSON.stringify({ pin }) })
}

export function setCurrentSong(id, index, { takeover = false } = {}) {
  return apiFetch(`/setlists/${id}/current`, { method: 'PUT', body: JSON.stringify({ index, takeover }) })
}

export const getLive = (id) => apiFetch(`/setlists/${id}/live`)
export const releaseLive = (id) => apiFetch(`/setlists/${id}/live/release`, { method: 'POST' })

// 확정 · 이력 · 변경 확인 · 복원
export const confirmSetlist = (id, baseRevision) =>
  apiFetch(`/setlists/${id}/confirm`, { method: 'POST', body: JSON.stringify({ baseRevision }) })
export const unconfirmSetlist = (id, baseRevision) =>
  apiFetch(`/setlists/${id}/unconfirm`, { method: 'POST', body: JSON.stringify({ baseRevision }) })
export const getHistory = (id) => apiFetch(`/setlists/${id}/history`)
export const ackSetlist = (id, revision) => apiFetch(`/setlists/${id}/ack`, { method: 'POST', body: JSON.stringify({ revision }) })
export const restoreSetlist = (id, revision, baseRevision) =>
  apiFetch(`/setlists/${id}/restore`, { method: 'POST', body: JSON.stringify({ revision, baseRevision }) })

// 연습 완료 (로그인한 사람 기준)
export const getPractice = (id) => apiFetch(`/setlists/${id}/practice`)
export const setPractice = (id, songId, done) =>
  apiFetch(`/setlists/${id}/practice/${songId}`, { method: 'PUT', body: JSON.stringify({ done }) })

export function updateSetlistItems(id, items, baseRevision) {
  return apiFetch(`/setlists/${id}/items`, { method: 'PUT', body: JSON.stringify({ items, baseRevision }) })
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
