import { createContext, useEffect, useState } from 'react'
import { loginRequest, signupRequest } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })
  const [loading, setLoading] = useState(false)

  function persist(tok, usr) {
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
      persist(data.token, data.user || { email: data.email, _id: data._id })
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
    persist(null, null)
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
        isAuthenticated: Boolean(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext