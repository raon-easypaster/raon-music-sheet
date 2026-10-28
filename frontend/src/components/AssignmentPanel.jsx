import { useEffect, useState } from 'react'
import {
  getAssignments,
  createAssignment,
  deleteAssignment,
  respondAssignment,
  getUnavailability,
} from '../api/teamExtras'
import { isoToDateInput, formatKoreanDate } from '../utils/dates'
import { ROLE_PRESETS, STATUS_LABEL, sameId, memberName } from './teamExtrasShared'
import './teamExtras.css'

const CUSTOM_ROLE = '__custom__'

// 콘티 한 개의 팀원 배정 (누가 어떤 자리를 맡는지 + 수락·거절 상태)
// props: setlist(콘티), team(팀 객체 또는 팀 id), members([{ _id, email }] — 없으면 team.members), currentUserId
export default function AssignmentPanel({ setlist, team, members, currentUserId }) {
  const teamId = team?._id || team || ''
  const memberList = members || team?.members || []
  const setlistId = setlist?._id || ''
  const isTeamSetlist = !!teamId && !!setlist?.team && sameId(setlist.team, teamId)

  const [assignments, setAssignments] = useState([])
  const [unavailable, setUnavailable] = useState([])
  const [version, setVersion] = useState(0)
  const [role, setRole] = useState(ROLE_PRESETS[0])
  const [customRole, setCustomRole] = useState('')
  const [userId, setUserId] = useState('')
  const [declining, setDeclining] = useState(null) // 거절 이유를 적고 있는 배정 id
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isTeamSetlist) return undefined
    let alive = true
    Promise.all([getAssignments(teamId, setlistId), getUnavailability(teamId)])
      .then(([a, u]) => {
        if (!alive) return
        setAssignments(Array.isArray(a) ? a : [])
        setUnavailable(Array.isArray(u) ? u : [])
      })
      .catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [isTeamSetlist, teamId, setlistId, version])

  if (!setlist) return null
  if (!isTeamSetlist) {
    return (
      <div className="tx-box">
        <h3 className="tx-title">팀원 배정</h3>
        <p className="muted tx-note">팀에서 쓰는 기능입니다. 팀 작업 공간의 콘티에서 누가 어떤 자리를 맡을지 정할 수 있습니다.</p>
      </div>
    )
  }

  // 이 콘티 날짜에 못 나온다고 표시한 팀원
  const gigDay = isoToDateInput(setlist.gigDate)
  const awayOnGig = gigDay ? unavailable.filter((u) => isoToDateInput(u.date) === gigDay) : []
  const awayNote = (id) => awayOnGig.find((u) => sameId(u.user, id))
  const selectedAway = userId ? awayNote(userId) : null

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      setVersion((v) => v + 1)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    const finalRole = (role === CUSTOM_ROLE ? customRole : role).trim()
    if (!userId) { setError('배정할 팀원을 골라 주세요'); return }
    if (!finalRole) { setError('맡을 자리를 적어 주세요'); return }
    const ok = await run(() => createAssignment(teamId, { setlist: setlistId, user: userId, role: finalRole }))
    if (ok) { setUserId(''); setCustomRole('') }
  }

  function handleRemove(a) {
    if (!window.confirm(`${memberName(a.user)} 님을 '${a.role}' 자리에서 뺄까요?`)) return
    run(() => deleteAssignment(teamId, a._id))
  }

  async function handleDecline(a) {
    const ok = await run(() => respondAssignment(teamId, a._id, 'declined', reason))
    if (ok) { setDeclining(null); setReason('') }
  }

  return (
    <div className="tx-box">
      <h3 className="tx-title">팀원 배정</h3>
      {setlist.gigDate
        ? <p className="muted tx-note">{formatKoreanDate(setlist.gigDate)} · 배정받은 팀원은 ‘팀 소식’ 탭에서 수락하거나 거절합니다</p>
        : <p className="muted tx-note">콘티에 날짜를 넣으면 못 나오는 팀원을 함께 알려 드립니다</p>}

      {error && <p className="error-text">{error}</p>}

      {assignments.length === 0 ? (
        <p className="muted tx-note">아직 배정된 팀원이 없습니다</p>
      ) : (
        <ul className="tx-list">
          {assignments.map((a) => {
            const mine = sameId(a.user, currentUserId)
            return (
              <li key={a._id} className="tx-row">
                <div className="tx-row-main">
                  <span className="tx-role">{a.role}</span>
                  <span className="tx-name">{memberName(a.user)}{mine && ' (나)'}</span>
                  <span className={`tx-status tx-status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  {awayNote(a.user?._id) && <span className="tx-warn">이 날 못 나온다고 표시함</span>}
                </div>
                {a.status === 'declined' && a.declineReason && (
                  <p className="tx-reason">거절 이유: {a.declineReason}</p>
                )}
                <div className="tx-actions">
                  {mine && a.status !== 'accepted' && (
                    <button type="button" disabled={busy} onClick={() => run(() => respondAssignment(teamId, a._id, 'accepted'))}>수락</button>
                  )}
                  {mine && a.status !== 'declined' && declining !== a._id && (
                    <button type="button" className="secondary" disabled={busy} onClick={() => { setDeclining(a._id); setReason('') }}>거절</button>
                  )}
                  <button type="button" className="secondary" disabled={busy} onClick={() => handleRemove(a)}>빼기</button>
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
                    <button type="button" disabled={busy} onClick={() => handleDecline(a)}>거절하기</button>
                    <button type="button" className="secondary" onClick={() => setDeclining(null)}>취소</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form className="tx-form" onSubmit={handleAdd}>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="맡을 자리">
          {ROLE_PRESETS.map((r) => <option key={r} value={r}>{r}</option>)}
          <option value={CUSTOM_ROLE}>직접 입력</option>
        </select>
        {role === CUSTOM_ROLE && (
          <input
            type="text"
            placeholder="자리 이름 (20자 이내)"
            maxLength={20}
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
          />
        )}
        <select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="배정할 팀원">
          <option value="">팀원 고르기</option>
          {memberList.map((m) => (
            <option key={m._id} value={m._id}>
              {memberName(m)}{awayNote(m._id) ? ' — 이 날 못 나온다고 표시함' : ''}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy}>배정</button>
      </form>
      {selectedAway && (
        <p className="tx-warn tx-warn-block">
          이 날 못 나온다고 표시함{selectedAway.note ? ` (${selectedAway.note})` : ''} — 그래도 배정할 수는 있습니다
        </p>
      )}
    </div>
  )
}
