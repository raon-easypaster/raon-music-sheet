import { apiFetch } from './client'

const pinHeader = (pin) => (pin ? { 'x-share-pin': pin } : {})

// 공유 링크로 보는 필기. 로그인한 팀원이면 응답에 canEdit·setlistId가 함께 온다
export function getPublicAnnotation(token, songId, pin) {
  return apiFetch(`/annotations/public/${token}/${songId}`, { headers: pinHeader(pin) })
}

export function getAnnotation(setlistId, songId) {
  return apiFetch(`/annotations/${setlistId}/${songId}`)
}

export function saveAnnotation(setlistId, songId, strokes, baseVersion) {
  return apiFetch(`/annotations/${setlistId}/${songId}`, {
    method: 'PUT',
    body: JSON.stringify({ strokes, baseVersion }),
  })
}
