import { useEffect, useState } from 'react'
import { getAttendance, createAttendance, updateAttendance, deleteAttendance } from '../api/teamExtras'
import { formatKoreanDate, toDateInput } from '../utils/dates'
import { sameId, memberName } from './teamExtrasShared'

const KINDS = ['예배', '연습', '기타']

// 출석 체크 + 최근 3개월 출석률
export default function AttendanceBook({ team, currentUserId }) {
  const teamId = team._id
  const members = team.members || []
  const isOwner = sameId(team.owner, currentUserId)

  const [data, setData] = useState({ events: [], stats: [], totalEvents: 0 })
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState(() => ({ date: toDateInput(new Date()), kind: '예배', title: '' }))
  const [openId, setOpenId] = useState(null) // 출석을 체크하고 있는 출석부
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getAttendance(teamId)
      .then((d) => { if (alive) setData({ events: d.events || [], stats: d.stats || [], totalEvents: d.totalEvents || 0 }) })
      .catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [teamId, version])

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      const result = await action()
      setVersion((v) => v + 1)
      return result || true
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const created = await run(() => createAttendance(teamId, { ...form, title: form.title.trim(), present: [] }))
    if (created?._id) { setOpenId(created._id); setForm((f) => ({ ...f, title: '' })) }
  }

  function togglePresent(event, memberId) {
    const has = event.present.some((p) => sameId(p, memberId))
    const present = has ? event.present.filter((p) => !sameId(p, memberId)) : [...event.present, memberId]
    // 화면에 바로 반영하고 저장한다
    setData((d) => ({ ...d, events: d.events.map((ev) => (ev._id === event._id ? { ...ev, present } : ev)) }))
    run(() => updateAttendance(teamId, event._id, { present: present.map(String) }))
  }

  function handleDelete(event) {
    if (!window.confirm(`${formatKoreanDate(event.date)} ${event.title || event.kind} 출석부를 지울까요?`)) return
    run(() => deleteAttendance(teamId, event._id))
  }

  const { events, stats, totalEvents } = data

  return (
    <div>
      <form className="tx-form" onSubmit={handleCreate}>
        <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required aria-label="날짜" />
        <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} aria-label="종류">
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input
          type="text"
          placeholder="이름 (선택, 예: 주일 2부 예배)"
          maxLength={50}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <button type="submit" disabled={busy}>출석부 만들기</button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <h3 className="tx-title">최근 3개월 출석률</h3>
      <p className="muted tx-note">출석부 {totalEvents}개 기준</p>
      {totalEvents > 0 && (
        <ul className="tx-stats">
          {[...stats].sort((a, b) => b.rate - a.rate).map((s) => (
            <li key={s.user._id}>
              <span className="tx-name">{memberName(s.user)}</span>
              <span className="tx-bar"><span style={{ width: `${s.rate}%` }} /></span>
              <span className="tx-rate">{s.rate}% ({s.present}/{totalEvents})</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="tx-title">출석부</h3>
      {events.length === 0 ? (
        <p className="muted">최근 3개월 동안 만든 출석부가 없습니다. 위에서 날짜를 고르고 출석부를 만들어 보세요.</p>
      ) : (
        <ul className="tx-list">
          {events.map((ev) => {
            const open = openId === ev._id
            const canDelete = isOwner || sameId(ev.createdBy, currentUserId)
            return (
              <li key={ev._id} className="tx-row">
                <div className="tx-row-main">
                  <span className="setlist-date">{formatKoreanDate(ev.date)}</span>
                  <span className="tx-role">{ev.kind}</span>
                  {ev.title && <strong className="tx-name">{ev.title}</strong>}
                  <span className="muted-dark">출석 {ev.present.length}/{members.length}명</span>
                </div>
                <div className="tx-actions">
                  <button type="button" className="secondary" onClick={() => setOpenId(open ? null : ev._id)}>
                    {open ? '체크 닫기' : '출석 체크'}
                  </button>
                  {canDelete && (
                    <button type="button" className="secondary" disabled={busy} onClick={() => handleDelete(ev)}>지우기</button>
                  )}
                </div>
                {open && (
                  <div className="checkbox-list tx-checks">
                    {members.map((m) => (
                      <label key={m._id} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={ev.present.some((p) => sameId(p, m._id))}
                          onChange={() => togglePresent(ev, m._id)}
                        />
                        {memberName(m)}
                      </label>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
