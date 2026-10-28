import { apiFetch } from './client'

const pinHeader = (pin) => (pin ? { 'x-share-pin': pin } : {})
// 악보 페이지 번호 (없으면 예전 방식: 곡마다 필기 하나)
const pageQuery = (page) => (page ? `?page=${encodeURIComponent(page)}` : '')

// 공유 링크로 보는 필기. 로그인한 팀원이면 응답에 canEdit·setlistId가 함께 온다
export function getPublicAnnotation(token, songId, pin, page) {
  return apiFetch(`/annotations/public/${token}/${songId}${pageQuery(page)}`, { headers: pinHeader(pin) })
}

export function getAnnotation(setlistId, songId, page) {
  return apiFetch(`/annotations/${setlistId}/${songId}${pageQuery(page)}`)
}

export function saveAnnotation(setlistId, songId, strokes, baseVersion, page) {
  return apiFetch(`/annotations/${setlistId}/${songId}${pageQuery(page)}`, {
    method: 'PUT',
    body: JSON.stringify({ strokes, baseVersion }),
  })
}
