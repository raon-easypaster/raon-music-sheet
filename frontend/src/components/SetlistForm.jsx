import { useState } from 'react'

export default function SetlistForm({ onCreate }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await onCreate({ name })
      setName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h2>콘티 만들기</h2>

      <input
        type="text"
        placeholder="콘티 이름 (예: 9월 1주 주일예배)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <button type="submit" disabled={submitting}>
        {submitting ? '저장 중...' : '콘티 저장'}
      </button>

      {error ? <p className="error-text">{error}</p> : null}
    </form>
  )
}