import { useEffect, useState } from 'react'
import { getMyAssignments, respondAssignment } from '../api/teamExtras'
import { formatKoreanDate } from '../utils/dates'
import { STATUS_LABEL } from './teamExtrasShared'

// 내게 배정된 다가오는 예배 (수락·거절)
export default function MyAssignments({ teamId, onChanged }) {
  const [data, setData] = useState({ assignments: [], pendingCount: 0, loaded: false })
  const [version, setVersion] = useState(0)
  const [declining, setDeclining] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getMyAssignments(teamId)
      .then((d) => { if (alive) setData({ assignments: d.assignments || [], pendingCount: d.pendingCount || 0, loaded: true }) })
      .catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [teamId, version])

  async function respond(a, status) {
    setBusy(true)
    setError('')
    try {
      await respondAssignment(teamId, a._id, status, status === 'declined' ? reason : '')
      setDeclining(null)
      setReason('')
      setVersion((v) => v + 1)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const { assignments, pendingCount, loaded } = data

  return (
    <div>
      <p className="muted tx-note">
        {pendingCount > 0
          ? `아직 답하지 않은 배정이 ${pendingCount}개 있습니다. 나올 수 있으면 ‘수락’, 어려우면 ‘거절’을 눌러 주세요.`
          : '다가오는 예배에 배정된 자리입니다. 답을 바꾸고 싶으면 다시 누르면 됩니다.'}
      </p>
      {error && <p className="error-text">{error}</p>}

      {!loaded ? (
        <p className="muted">불러오는 중...</p>
      ) : assignments.length === 0 ? (
        <p className="muted">다가오는 배정이 없습니다</p>
      ) : (
        <ul className="tx-list">
          {assignments.map((a) => (
            <li key={a._id} className="tx-row">
              <div className="tx-row-main">
                <span className="setlist-date">{a.setlist.gigDate ? formatKoreanDate(a.setlist.gigDate) : '날짜 미정'}</span>
                <strong className="tx-name">{a.setlist.name}</strong>
                <span className="tx-role">{a.role}</span>
                <span className={`tx-status tx-status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
              </div>
              {a.status === 'declined' && a.declineReason && <p className="tx-reason">거절 이유: {a.declineReason}</p>}
              <div className="tx-actions">
                {a.status !== 'accepted' && (
                  <button type="button" disabled={busy} onClick={() => respond(a, 'accepted')}>수락</button>
                )}
                {a.status !== 'declined' && declining !== a._id && (
                  <button type="button" className="secondary" disabled={busy} onClick={() => { setDeclining(a._id); setReason('') }}>거절</button>
                )}
              </div>
              {declining === a._id && (
                <div className="tx-inline">
                  <input
                    type="text"
                    placeholder="거절 이유 (선택, 200자 이내)"
                    maxLength={200}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button type="button" disabled={busy} onClick={() => respond(a, 'declined')}>거절하기</button>
                  <button type="button" className="secondary" onClick={() => setDeclining(null)}>취소</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
