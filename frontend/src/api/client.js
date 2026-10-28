const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : import.meta.env.PROD
    ? '/api'
    : 'http://localhost:5001/api';

  
export function getToken() {
  return localStorage.getItem('token')
}

export async function apiFetch(endpoint, { skipAuth, ...options } = {}) {
  // 공유 화면 요청(skipAuth)에는 로그인 정보를 싣지 않는다 → 오프라인 저장본도 쓸 수 있다
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