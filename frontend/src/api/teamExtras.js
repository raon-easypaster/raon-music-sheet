import { apiFetch } from './client'

// 팀 소식: 배정·못 나오는 날·공지·기도제목·출석 (모두 팀원 전용)
const base = (teamId) => `/team-extras/${teamId}`
const send = (method, body) => ({ method, ...(body !== undefined && { body: JSON.stringify(body) }) })

// 배정
export const getAssignments = (teamId, setlistId) =>
  apiFetch(`${base(teamId)}/assignments?setlist=${encodeURIComponent(setlistId)}`)
export const createAssignment = (teamId, payload) => apiFetch(`${base(teamId)}/assignments`, send('POST', payload))
export const deleteAssignment = (teamId, id) => apiFetch(`${base(teamId)}/assignments/${id}`, send('DELETE'))
export const respondAssignment = (teamId, id, status, declineReason = '') =>
  apiFetch(`${base(teamId)}/assignments/${id}/respond`, send('PUT', { status, declineReason }))
export const getMyAssignments = (teamId) => apiFetch(`${base(teamId)}/my-assignments`)

// 못 나오는 날
export const getUnavailability = (teamId) => apiFetch(`${base(teamId)}/unavailability`)
export const addUnavailability = (teamId, date, note) =>
  apiFetch(`${base(teamId)}/unavailability`, send('POST', { date, note }))
export const deleteUnavailability = (teamId, id) => apiFetch(`${base(teamId)}/unavailability/${id}`, send('DELETE'))

// 공지 · 기도제목
export const getUnread = (teamId) => apiFetch(`${base(teamId)}/unread`)
export const getPosts = (teamId, before) =>
  apiFetch(`${base(teamId)}/posts${before ? `?before=${encodeURIComponent(before)}` : ''}`)
export const markPostsSeen = (teamId) => apiFetch(`${base(teamId)}/posts/seen`, send('POST'))
export const createPost = (teamId, payload) => apiFetch(`${base(teamId)}/posts`, send('POST', payload))
export const deletePost = (teamId, id) => apiFetch(`${base(teamId)}/posts/${id}`, send('DELETE'))
export const pinPost = (teamId, id, pinned) => apiFetch(`${base(teamId)}/posts/${id}/pin`, send('PUT', { pinned }))
export const togglePray = (teamId, id) => apiFetch(`${base(teamId)}/posts/${id}/pray`, send('PUT'))

// 출석
export const getAttendance = (teamId) => apiFetch(`${base(teamId)}/attendance`)
export const createAttendance = (teamId, payload) => apiFetch(`${base(teamId)}/attendance`, send('POST', payload))
export const updateAttendance = (teamId, id, payload) =>
  apiFetch(`${base(teamId)}/attendance/${id}`, send('PUT', payload))
export const deleteAttendance = (teamId, id) => apiFetch(`${base(teamId)}/attendance/${id}`, send('DELETE'))
