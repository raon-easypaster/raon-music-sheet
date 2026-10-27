import { useEffect, useState } from 'react'
import { getMyTeams, createTeam, joinTeam, leaveTeam, deleteTeam, moveMyItemsToTeam, resetMemberPassword } from '../api/teams'

export default function TeamPanel({ currentUserId, onTeamsChanged, onItemsMoved }) {
  const [teams, setTeams] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(null)
  const [notice, setNotice] = useState('')
  // 방금 초기화한 팀원의 임시 비밀번호 (화면에 한 번만 보여 준다)
  const [resetResult, setResetResult] = useState(null)

  async function load() {
    try {
      const data = await getMyTeams()
      setTeams(Array.isArray(data) ? data : [])
      onTeamsChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await createTeam({ name: newTeamName.trim() })
      setNewTeamName('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await joinTeam(inviteCode.trim())
      setInviteCode('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLeave(id) {
    setSubmitting(true)
    setError('')
    try {
      await leaveTeam(id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(team) {
    if (!window.confirm(`'${team.name}' 팀을 삭제할까요?\n팀 곡·콘티는 지워지지 않고, 각자 만든 사람의 개인 공간으로 돌아갑니다.`)) return
    setSubmitting(true)
    setError('')
    try {
      await deleteTeam(team._id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMoveItems(team) {
    if (!window.confirm(`내 개인 공간의 곡·콘티를 모두 '${team.name}' 팀으로 옮길까요?\n옮기면 팀원 모두가 보고 편집할 수 있습니다.`)) return
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const res = await moveMyItemsToTeam(team._id)
      setNotice(res.message)
      onItemsMoved?.(team._id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(team, member) {
    if (!window.confirm(`${member.email} 님의 비밀번호를 임시 비밀번호로 초기화할까요?\n지금 쓰던 비밀번호로는 더 이상 로그인할 수 없습니다.`)) return
    setSubmitting(true)
    setError('')
    setResetResult(null)
    try {
      const res = await resetMemberPassword(team._id, member._id)
      setResetResult({ teamId: team._id, email: res.email, tempPassword: res.tempPassword })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="card panel">
      <h2>팀 관리</h2>

      <p className="muted" style={{ marginTop: 0 }}>
        팀을 만들거나 초대 코드로 참여한 뒤, 화면 위 <strong>작업 공간</strong>에서 팀을 고르면
        팀원 모두가 같은 곡·콘티를 보고 편집할 수 있습니다.
      </p>

      {error && <p className="error-text">{error}</p>}
      {notice && <p style={{ color: 'green' }}>{notice}</p>}

      <div className="team-forms">
        <form onSubmit={handleCreate} className="inline-form">
          <input
            type="text"
            placeholder="새 팀 이름"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button type="submit" disabled={submitting}>팀 만들기</button>
        </form>

        <form onSubmit={handleJoin} className="inline-form">
          <input
            type="text"
            placeholder="초대 코드 입력"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            maxLength={8}
            style={{ textTransform: 'uppercase' }}
          />
          <button type="submit" disabled={submitting}>팀 참여</button>
        </form>
      </div>

      {teams.length === 0 ? (
        <p className="muted">소속된 팀이 없습니다</p>
      ) : (
        <ul className="item-list" style={{ marginTop: '1rem' }}>
          {teams.map((team) => (
            <li key={team._id} className="team-row">
              <div>
                <strong>{team.name}</strong>
                <span className="muted"> · {team.members?.length || 0}명</span>
                {team.owner && (
                  <span className="muted"> · 팀장: {team.owner.email}</span>
                )}
              </div>
              <div className="badge-row" style={{ marginTop: 4 }}>
                <button
                  className="secondary badge-code"
                  onClick={() => copyCode(team.inviteCode)}
                  title="초대코드 복사"
                >
                  {copied === team.inviteCode ? '복사됨!' : `초대코드: ${team.inviteCode}`}
                </button>
                <button
                  className="secondary"
                  onClick={() => handleMoveItems(team)}
                  disabled={submitting}
                >
                  내 곡·콘티를 이 팀으로 옮기기
                </button>
                {team.owner?._id === currentUserId ? (
                  <button
                    onClick={() => handleDelete(team)}
                    disabled={submitting}
                  >
                    팀 삭제
                  </button>
                ) : (
                  <button
                    className="secondary"
                    onClick={() => handleLeave(team._id)}
                    disabled={submitting}
                  >
                    나가기
                  </button>
                )}
              </div>

              {team.owner?._id === currentUserId && (
                <div className="member-list">
                  <span className="muted" style={{ fontSize: 13 }}>팀원</span>
                  {team.members?.map((m) => (
                    <div key={m._id} className="member-row">
                      <span>{m.email}{m._id === currentUserId ? ' (나)' : ''}</span>
                      {m._id !== currentUserId && (
                        <button
                          className="secondary"
                          onClick={() => handleResetPassword(team, m)}
                          disabled={submitting}
                        >
                          비밀번호 초기화
                        </button>
                      )}
                    </div>
                  ))}

                  {resetResult?.teamId === team._id && (
                    <div className="notice-text">
                      <strong>{resetResult.email}</strong> 님의 임시 비밀번호:
                      <div className="temp-password">{resetResult.tempPassword}</div>
                      이 비밀번호를 팀원에게 직접 알려 주세요. 이 창을 벗어나면 다시 볼 수 없습니다.
                      팀원이 로그인하면 새 비밀번호로 바꾸는 창이 바로 열립니다.
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
