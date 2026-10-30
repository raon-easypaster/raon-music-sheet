const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : import.meta.env.PROD
    ? '/api'
    : 'http://localhost:5001/api';

  
// 앱에 올린 악보 파일 주소(/api/sheets/…)를 실제로 열 수 있는 주소로 (개발 화면은 서버 주소가 달라서)
export function assetUrl(url) {
  if (!url || !url.startsWith('/api/') || !/^https?:/.test(API_BASE_URL)) return url
  return API_BASE_URL.replace(/\/api$/, '') + url
}

export function getToken() {
  return localStorage.getItem('token')
}

export async function apiFetch(endpoint, { skipAuth, ...options } = {}) {
  // skipAuth: 로그인 정보를 싣지 않는 요청
  const token = skipAuth ? null : getToken()

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    // 개발 화면처럼 서버 주소가 다르면 악보 파일용 쿠키를 함께 주고받는다 (배포는 같은 주소라 기본값으로 충분)
    ...(/^https?:/.test(API_BASE_URL) ? { credentials: 'include' } : {}),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed')
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}