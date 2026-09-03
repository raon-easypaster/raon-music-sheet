import { useEffect, useState } from 'react'
import { getMyTeams, createTeam, joinTeam, leaveTeam, deleteTeam } from '../api/teams'

export default function TeamPanel() {
  const [teams, setTeams] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(null)

  async function load() {
    try {
      const data = await getMyTeams()
      setTeams(Array.isArray(data) ? data : [])
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

  async function handleDelete(id) {
    setSubmitting(true)
    setError('')
    try {
      await deleteTeam(id)
      await load()
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

      {error && <p className="error-text">{error}</p>}

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
                  onClick={() => handleLeave(team._id)}
                  disabled={submitting}
                >
                  나가기
                </button>
                {team.owner?._id === undefined && (
                  <button
                    onClick={() => handleDelete(team._id)}
                    disabled={submitting}
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
