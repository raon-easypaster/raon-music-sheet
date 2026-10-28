// 팀 소식 화면들이 함께 쓰는 값

export const ROLE_PRESETS = ['인도', '싱어', '건반', '일렉', '베이스', '드럼', '어쿠스틱', '음향', '자막', '기타']

export const STATUS_LABEL = { pending: '응답 대기', accepted: '수락', declined: '거절' }

export const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '')

export const memberName = (user) => user?.email || '(나간 팀원)'

export const shortDateTime = (iso) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
