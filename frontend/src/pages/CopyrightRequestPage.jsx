import { useState } from 'react'
import { Link } from 'react-router-dom'
import { submitCopyrightRequest } from '../api/copyright'

const ROLES = [
  { value: 'owner', label: '저작권자 (작사·작곡·편곡자)' },
  { value: 'publisher', label: '출판사·음악 출판 회사' },
  { value: 'agent', label: '저작권자의 대리인' },
  { value: 'other', label: '기타' },
]
const EMPTY = { name: '', email: '', role: 'owner', work: '', location: '', details: '', statement: false }

// 저작권 침해 신고 · 삭제 요청 (로그인 없이 누구나)
export default function CopyrightRequestPage() {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null) // { receipt, message }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setDone(await submitCopyrightRequest(form))
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dashboard copyright-page">
      <div className="card panel">
        <h2>©️ 저작권 침해 신고 · 삭제 요청</h2>
        <p>
          RAON music sheet는 찬양팀이 <b>직접 올린 악보</b>를 팀 안에서 예배·연습용으로 쓰는 앱입니다.
          앱이 악보를 미리 넣어 두거나 판매하지 않습니다. 권리를 가진 악보가 허락 없이 올라와 있다면 아래로 알려 주세요.
        </p>
        <ul className="copyright-steps">
          <li>신고가 들어오면 운영자가 확인하고, 해당 악보 파일을 앱에서 <b>더 이상 보이지 않게 차단</b>합니다. 차단은 보통 하루 안에 모든 화면에 반영됩니다.</li>
          <li>처리 결과는 적어 주신 이메일로 알려 드립니다.</li>
          <li>다른 사이트 주소로 넣은 악보는 앱이 파일을 보관하지 않습니다. 그 경우 해당 공유 링크를 잠그고, 원래 사이트에도 함께 알려 주시길 권합니다.</li>
        </ul>
      </div>

      {done ? (
        <div className="card panel copyright-done" role="status">
          <h3>✓ 신고가 접수되었습니다</h3>
          <p>접수 번호 <b className="copyright-receipt">{done.receipt}</b></p>
          <p>{done.message} 문의할 때 접수 번호를 함께 알려 주세요.</p>
          <button type="button" className="secondary" onClick={() => setDone(null)}>다른 신고 하기</button>
        </div>
      ) : (
        <form className="card panel copyright-form" onSubmit={submit}>
          <label>
            이름 (또는 회사 이름) *
            <input type="text" maxLength={60} value={form.name} onChange={set('name')} required />
          </label>
          <label>
            답변 받을 이메일 *
            <input type="email" maxLength={120} value={form.email} onChange={set('email')} required autoCapitalize="none" />
          </label>
          <label>
            신고하는 분
            <select value={form.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label>
            곡 제목 · 저작물 *
            <input type="text" maxLength={200} value={form.work} onChange={set('work')} placeholder="예: ‘은혜’ (작사·작곡 ○○○)" required />
          </label>
          <label>
            어디에 있나요? (공유 링크 · 악보 주소)
            <textarea rows={3} maxLength={1000} value={form.location} onChange={set('location')}
              placeholder="예: https://raon-music-sheet.vercel.app/share/… 또는 악보 그림 주소. 받은 링크를 그대로 붙여 넣어 주세요." />
          </label>
          <label>
            자세한 내용
            <textarea rows={4} maxLength={3000} value={form.details} onChange={set('details')}
              placeholder="권리 관계(어떤 권리를 가지고 계신지), 요청 내용(삭제·차단 등)을 적어 주세요." />
          </label>
          <label className="rights-check">
            <input type="checkbox" checked={form.statement} onChange={set('statement')} />
            저는 이 저작물의 권리자이거나 권리자로부터 위임받은 사람이며, 위 내용을 사실대로 적었습니다.
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={busy || !form.statement}>{busy ? '보내는 중…' : '신고 보내기'}</button>
          <p className="muted-dark copyright-privacy">적어 주신 이름·이메일은 이 신고를 처리하고 답변하는 데에만 씁니다.</p>
        </form>
      )}
      <p className="copyright-back"><Link to="/">RAON music sheet로 가기</Link></p>
    </div>
  )
}
