import { useEffect, useState } from 'react'
import { getAssignments } from '../api/teamExtras'
import { memberName, sameId, shortDateTime } from './teamExtrasShared'
import { keyStateText } from '../utils/sheets'

const MARK = { ok: '✓', warn: '!', bad: '✕', info: '·' }

function Row({ level, title, children, action }) {
  return (
    <li className={`ready-row ready-${level}`}>
      <span className="ready-mark" aria-hidden="true">{MARK[level]}</span>
      <div className="ready-body">
        <b>{title}</b>
        <div className="ready-detail">{children}</div>
      </div>
      {action}
    </li>
  )
}

const names = (list, max = 4) => list.slice(0, max).join(', ') + (list.length > max ? ` 외 ${list.length - max}곡` : '')

function offlineRow(offline) {
  const s = offline.status
  if (!s) return { level: 'info', text: '이 기기의 저장 상태를 확인하는 중…' }
  const count = `악보 ${s.savedSongs}/${s.totalSongs}곡`
  const when = s.at ? ` (${shortDateTime(s.at)} 저장)` : ''
  switch (s.state) {
    case 'nothing': return { level: 'info', text: '이 콘티에는 저장할 악보가 없습니다.' }
    case 'unsupported':
      return { level: 'warn', text: s.swReady === false && typeof caches !== 'undefined'
        ? '오프라인 저장이 아직 켜지지 않았습니다. 앱을 한 번 새로고침하거나, 설치한 앱으로 열어 주세요.'
        : '이 브라우저에서는 오프라인 저장을 쓸 수 없습니다. 앱으로 설치하거나 최신 크롬·사파리를 써 주세요.' }
    case 'complete': return { level: 'ok', text: `이 기기에서 ${count} 저장 완료${when}` }
    case 'stale': return { level: 'warn', text: `콘티나 악보가 바뀌어 다시 저장해야 합니다 (지금 이 기기에 ${count}${when})` }
    case 'partial': return { level: 'warn', text: `이 기기에 ${count}만 저장됨 — 빠진 곡: ${names(s.missing)}` }
    case 'failed': return { level: 'bad', text: '저장하지 못했습니다. 인터넷 연결을 확인하고 다시 저장해 주세요.' }
    default: return { level: 'warn', text: `아직 이 기기에 저장하지 않았습니다 (${count})` }
  }
}

// 예배 준비 점검: 악보·Key·이 기기 저장·연결·배정·연습·변경 확인을 한곳에
// songs: [{ _id, title, choice: { sheet, keyState, key } }]
export default function ReadinessPanel({ setlist, team, songs, offline, online, practice, history }) {
  const [loaded, setLoaded] = useState(null) // { setlistId, list }
  const teamId = team?._id
  const isTeam = !!teamId && sameId(setlist.team, teamId)
  const assignments = isTeam && loaded?.setlistId === setlist._id ? loaded.list : null

  useEffect(() => {
    if (!isTeam) return undefined
    let alive = true
    getAssignments(teamId, setlist._id)
      .then((a) => { if (alive) setLoaded({ setlistId: setlist._id, list: Array.isArray(a) ? a : [] }) })
      .catch(() => {})
    return () => { alive = false }
  }, [isTeam, teamId, setlist._id, setlist.revision])

  const noSheet = songs.filter((s) => !s.choice.sheet)
  const mismatch = songs.filter((s) => s.choice.keyState === 'mismatch')
  const unknown = songs.filter((s) => s.choice.keyState === 'unknown')
  const off = offlineRow(offline)
  const st = offline.status

  const counts = { pending: 0, accepted: 0, declined: 0 }
  for (const a of assignments || []) counts[a.status] += 1
  const waiting = (assignments || []).filter((a) => a.status !== 'accepted')

  const mine = practice?.mine
  const confirmed = setlist.status === 'confirmed'
  const revision = setlist.revision || 0
  const ackLatest = (history?.members || []).filter((m) => (history.acks.find((a) => sameId(a.user, m._id))?.revision ?? -1) >= revision)

  if (!songs.length) return null

  return (
    <div className="ready-box">
      <h3>예배 준비 점검</h3>
      <ul className="ready-list">
        <Row level={noSheet.length ? 'bad' : 'ok'} title="악보">
          {noSheet.length ? `악보가 없는 곡 ${noSheet.length}곡: ${names(noSheet.map((s) => s.title))}` : `모든 곡(${songs.length}곡)에 악보가 있습니다`}
        </Row>

        <Row level={mismatch.length ? 'bad' : unknown.length ? 'warn' : 'ok'} title="콘티 Key와 악보 Key">
          {!mismatch.length && !unknown.length && '모두 맞습니다'}
          {mismatch.map((s) => <div key={s._id}>{s.title}: {keyStateText(s.choice)}</div>)}
          {unknown.length > 0 && <div>악보 Key 미확인 {unknown.length}곡: {names(unknown.map((s) => s.title))} — 곡 수정에서 악보 Key를 적어 주세요</div>}
        </Row>

        <Row level={off.level} title="이 기기 오프라인 저장"
          action={offline.onSave && st?.state !== 'nothing' && st?.state !== 'unsupported' && (
            <button type="button" className="secondary" onClick={offline.onSave} disabled={offline.saving}>
              {offline.saving ? '저장 중…' : st?.state === 'complete' ? '다시 저장' : '저장하기'}
            </button>
          )}>
          {off.text}
          {st?.blocked?.length > 0 && (
            <div>저장할 수 없는 악보: {st.blocked.map((b) => `${b.title} (${b.reason})`).join(', ')}</div>
          )}
          {st && !['nothing', 'unsupported'].includes(st.state) && setlist.shareToken && !st.dataSaved && (
            <div className="muted">공유 화면의 곡 순서·Key는 아직 이 기기에 없습니다{setlist.hasSharePin ? ' (비밀번호가 걸린 콘티는 이 기기에서 공유 화면을 한 번 열어 주세요)' : ''}.</div>
          )}
        </Row>

        <Row level={online ? 'ok' : 'bad'} title="실시간 동기화">
          {online ? '인터넷 연결됨 · 인도자 진행이 공유 화면에 바로 전달됩니다' : '인터넷이 끊겨 실시간 동기화가 멈췄습니다. 저장해 둔 악보는 계속 볼 수 있어요.'}
        </Row>

        {isTeam && assignments && (
          <Row level={!assignments.length ? 'warn' : counts.declined ? 'bad' : counts.pending ? 'warn' : 'ok'} title="팀원 배정">
            {!assignments.length ? '아직 배정된 팀원이 없습니다' : `수락 ${counts.accepted} · 대기 ${counts.pending} · 거절 ${counts.declined}`}
            {waiting.length > 0 && (
              <div>{waiting.map((a) => `${a.role} ${memberName(a.user)}(${a.status === 'pending' ? '대기' : '거절'})`).join(', ')}</div>
            )}
          </Row>
        )}

        {mine && (
          <Row level={mine.stale ? 'warn' : mine.done === mine.total ? 'ok' : 'info'} title="연습 완료">
            나: {mine.done}/{mine.total}곡{mine.stale ? ` · 변경 후 재확인 필요 ${mine.stale}곡` : ''}
            {isTeam && practice.team?.length > 0 && (
              <div className="ready-members">
                {practice.team.map((m) => (
                  <span key={m.user._id} className={m.done === m.total ? 'is-done' : ''}>
                    {memberName(m.user)} {m.done}/{m.total}{m.stale ? ` (재확인 ${m.stale})` : ''}
                  </span>
                ))}
              </div>
            )}
          </Row>
        )}

        {isTeam && confirmed && history?.members?.length > 0 && (
          <Row level={ackLatest.length === history.members.length ? 'ok' : 'warn'} title="변경 확인">
            최신 판({revision}판) 확인 {ackLatest.length}/{history.members.length}명
          </Row>
        )}
      </ul>
    </div>
  )
}
