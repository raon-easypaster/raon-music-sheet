import { useEffect, useState } from 'react'
import { getUnavailability, addUnavailability, deleteUnavailability } from '../api/teamExtras'
import { formatKoreanDate, isoToDateInput, monthLabel, nextSunday } from '../utils/dates'
import { sameId, memberName } from './teamExtrasShared'

// 못 나오는 날: 내 날짜를 표시하고, 팀 전체의 날짜를 달별로 본다
export default function UnavailableDays({ teamId, currentUserId }) {
  const [list, setList] = useState([])
  const [version, setVersion] = useState(0)
  const [date, setDate] = useState(() => nextSunday())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getUnavailability(teamId)
      .then((d) => { if (alive) setList(Array.isArray(d) ? d : []) })
      .catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [teamId, version])

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
    if (!date) { setError('날짜를 골라 주세요'); return }
    if (await run(() => addUnavailability(teamId, date, note.trim()))) setNote('')
  }

  // 날짜별로 묶고, 달이 바뀌면 달 이름을 붙인다
  const byDay = []
  for (const u of list) {
    const day = isoToDateInput(u.date)
    const last = byDay.at(-1)
    if (last && last.day === day) last.items.push(u)
    else byDay.push({ day, iso: u.date, items: [u] })
  }

  return (
    <div>
      <form className="tx-form" onSubmit={handleAdd}>
        <label className="date-field tx-date-label">
          날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <input
          type="text"
          placeholder="메모 (선택, 예: 가족 여행)"
          maxLength={100}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="submit" disabled={busy}>못 나오는 날로 표시</button>
      </form>
      <p className="muted tx-note">표시한 날은 팀원 모두가 볼 수 있고, 콘티에 팀원을 배정할 때 알려 줍니다.</p>
      {error && <p className="error-text">{error}</p>}

      {byDay.length === 0 ? (
        <p className="muted">앞으로 못 나온다고 표시한 날이 없습니다</p>
      ) : (
        <div>
          {byDay.map((g, i) => (
            <div key={g.day}>
              {(i === 0 || monthLabel(byDay[i - 1].iso) !== monthLabel(g.iso)) && (
                <p className="setlist-month-label tx-month">{monthLabel(g.iso)}</p>
              )}
              <div className="tx-day">
                <span className="setlist-date tx-day-date">{formatKoreanDate(g.iso)}</span>
                <ul className="tx-day-list">
                  {g.items.map((u) => {
                    const mine = sameId(u.user, currentUserId)
                    return (
                      <li key={u._id} className={mine ? 'tx-mine' : ''}>
                        <span>{memberName(u.user)}{mine && ' (나)'}</span>
                        {u.note && <span className="muted-dark"> · {u.note}</span>}
                        {mine && (
                          <button
                            type="button"
                            className="secondary tx-small"
                            disabled={busy}
                            onClick={() => run(() => deleteUnavailability(teamId, u._id))}
                          >
                            지우기
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
