import { useState } from 'react'
import { useAuth } from '../context/useAuth'

export default function LoginForm() {
  const { login, signup, loading } = useAuth()
  const [isSignup, setIsSignup] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      if (isSignup) {
        await signup(form.email, form.password)
      } else {
        await login(form.email, form.password)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={handleSubmit}>
        <h1>RAON music sheet</h1>
        <p className="muted">찬양팀 악보 & 콘티 관리</p>

        <input
          type="email"
          name="email"
          placeholder="이메일"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="비밀번호 (6자 이상)"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? '처리 중...' : (isSignup ? '회원가입' : '로그인')}
        </button>

        <button
          type="button"
          className="secondary"
          style={{ marginTop: 8 }}
          onClick={() => { setIsSignup((v) => !v); setError('') }}
        >
          {isSignup ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
        </button>

        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </div>
  )
}
