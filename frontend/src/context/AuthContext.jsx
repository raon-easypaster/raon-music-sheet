import { createContext, useEffect, useState } from 'react'
import { loginRequest, signupRequest } from '../api/auth'
import { apiFetch, AUTH_EXPIRED_EVENT } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })
  const [loading, setLoading] = useState(false)
  // 로그인이 만료돼 자동으로 로그아웃됐을 때 로그인 화면에 안내를 띄운다
  const [expired, setExpired] = useState(false)

  function persist(tok, usr) {
    if (tok) setExpired(false)
    if (tok) localStorage.setItem('token', tok)
    else localStorage.removeItem('token')
    if (usr) localStorage.setItem('user', JSON.stringify(usr))
    else localStorage.removeItem('user')
    setToken(tok)
    setUser(usr)
  }

  async function login(email, password) {
    setLoading(true)
    try {
      const data = await loginRequest({ email, password })
      persist(data.token, data.user || { email: data.email, _id: data._id, mustChangePassword: !!data.mustChangePassword })
      return data
    } finally {
      setLoading(false)
    }
  }

  async function signup(email, password) {
    setLoading(true)
    try {
      const data = await signupRequest({ email, password })
      persist(data.token, { email: data.email, _id: data._id })
      return data
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    // 이 기기의 악보 파일 쿠키도 지운다 (로그아웃한 기기에서 악보 주소로 열리지 않게)
    apiFetch('/sheets/session', { method: 'DELETE', skipAuth: true }).catch(() => {})
    persist(null, null)
  }

  useEffect(() => {
    function onExpired() {
      if (!localStorage.getItem('token')) return
      logout()
      setExpired(true)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  })

  function markPasswordChanged() {
    persist(token, user ? { ...user, mustChangePassword: false } : user)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        signup,
        logout,
        markPasswordChanged,
        expired,
        isAuthenticated: Boolean(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext