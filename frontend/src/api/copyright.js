import { apiFetch } from './client'

// 저작권 침해 신고 (로그인 없이)
export function submitCopyrightRequest(payload) {
  return apiFetch('/copyright/requests', { method: 'POST', body: JSON.stringify(payload), skipAuth: true })
}

// 지금 로그인한 사람이 운영자인지 → { operator, open }
export function getOperatorInfo() {
  return apiFetch('/copyright/operator')
}

// ── 운영자 ──
export function listCopyrightRequests(status = '') {
  return apiFetch(`/copyright/admin/requests${status ? `?status=${status}` : ''}`)
}
export function getCopyrightRequest(id) {
  return apiFetch(`/copyright/admin/requests/${id}`)
}
export function updateCopyrightRequest(id, payload) {
  return apiFetch(`/copyright/admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function blockSheets(fileIds, requestId) {
  return apiFetch('/copyright/admin/blocks', { method: 'POST', body: JSON.stringify({ fileIds, requestId }) })
}
export function unblockSheet(fileId) {
  return apiFetch(`/copyright/admin/blocks/${fileId}`, { method: 'DELETE' })
}
export function lockRequestShare(id) {
  return apiFetch(`/copyright/admin/requests/${id}/lock-share`, { method: 'POST' })
}
