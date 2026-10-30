import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import AccountHelp from './AccountHelp'

export default function LoginForm() {
  const { login, signup, loading } = useAuth()
  const [isSignup, setIsSignup] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
      <section className="auth-hero" aria-hidden="true">
        <span className="brand">RAON music sheet</span>
        <blockquote>
          호흡이 있는 자마다 여호와를 찬양할지어다
          <cite>시편 150편 6절</cite>
        </blockquote>
        <small>라온동행교회 찬양팀 악보 &amp; 콘티</small>
      </section>
      <form className="card form-card" onSubmit={handleSubmit}>
        <h1>RAON music sheet</h1>
        <p className="muted">찬양팀 악보 & 콘티 관리</p>

        <input
          type="email"
          name="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="이메일"
          value={form.email}
          onChange={handleChange}
          required
        />

        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="비밀번호 (6자 이상)"
            value={form.password}
            onChange={handleChange}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={showPassword}
          >
            {showPassword ? '숨기기' : '보기'}
          </button>
        </div>

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

        {!isSignup && (
          <AccountHelp
            onUseEmail={(email) => { setForm((prev) => ({ ...prev, email })); setError('') }}
          />
        )}
        <p className="auth-copyright"><a href="/copyright">저작권 신고·문의</a></p>
      </form>
    </div>
  )
}
