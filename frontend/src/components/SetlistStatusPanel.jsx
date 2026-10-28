import { useCallback, useEffect, useState } from 'react'
import { getHistory, ackSetlist } from '../api/setlists'
import { sameId, memberName, shortDateTime } from './teamExtrasShared'

const RESTORE_SCOPE = [
  '되돌리는 것: 곡·곡 순서·콘티 Key·메모·악보 선택·예배 순서·예배 종류·시작 시각',
  '그대로 두는 것: 콘티 이름·날짜, 확정 상태, 공유 링크·비밀번호, 팀원 배정, 필기, 연습 기록',
  '되돌린 것도 새 판으로 기록되어 언제든 다시 되돌릴 수 있습니다.',
].join('\n')

// 콘티 상태(작성 중·확정), 변경 확인, 수정 이력·복원
// onHistory(history) — 준비 점검에 변경 확인 현황을 넘긴다
export default function SetlistStatusPanel({ setlist, team, currentUserId, onConfirm, onRestore, onError, onHistory }) {
  const [history, setHistory] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const id = setlist._id
  const revision = setlist.revision || 0

  const load = useCallback(async () => {
    try {
      const data = await getHistory(id)
      setHistory(data)
      onHistory?.(data)
    } catch { /* 이력을 못 불러와도 콘티는 쓸 수 있다 */ }
  }, [id, onHistory])

  useEffect(() => { load() }, [load, revision])
  useEffect(() => { setOpen(false) }, [id])

  async function run(action) {
    setBusy(true)
    try { await action() } catch (err) { onError?.(err) } finally { setBusy(false); load() }
  }

  const confirmed = setlist.status === 'confirmed'
  const canLead = !!history?.canLead
  const revisions = history?.revisions || []
  const afterConfirm = confirmed ? revisions.filter((r) => r.afterConfirm && r.revision > (setlist.confirmedRevision || 0)) : []
  const myAck = history?.acks.find((a) => sameId(a.user, currentUserId))?.revision
  // 팀 콘티가 확정됐는데 내가 최신 판을 확인하지 않았으면, 확인 뒤(또는 확정 뒤)에 바뀐 내용을 보여 준다
  const needAck = !!team && confirmed && (myAck ?? -1) < revision
  const since = myAck ?? (setlist.confirmedRevision || revision) - 1
  const unseen = revisions.filter((r) => r.revision > since && r.kind !== 'start')

  function restore(r) {
    if (!window.confirm(`${r.revision}판 내용으로 되돌릴까요?\n\n${RESTORE_SCOPE}`)) return
    run(() => onRestore(id, r.revision))
  }

  return (
    <div className={`status-panel status-${confirmed ? 'confirmed' : 'draft'}`}>
      <div className="status-row">
        <span className={`status-badge ${confirmed ? 'is-confirmed' : 'is-draft'}`}>{confirmed ? '확정' : '작성 중'}</span>
        <span className="status-text">
          {confirmed
            ? <>{setlist.confirmedAt && shortDateTime(setlist.confirmedAt)} 확정{setlist.confirmedBy?.email ? ` · ${setlist.confirmedBy.email}` : ''}
              {afterConfirm.length > 0 && <b className="status-changed"> · 확정 후 {afterConfirm.length}번 변경</b>}</>
            : '아직 바뀔 수 있는 콘티입니다'}
        </span>
        <span className="status-actions">
          {canLead && !confirmed && (
            <button type="button" disabled={busy} onClick={() => run(() => onConfirm(id, true))}>콘티 확정</button>
          )}
          {canLead && confirmed && afterConfirm.length > 0 && (
            <button type="button" disabled={busy} onClick={() => run(() => onConfirm(id, true))} title="바뀐 내용으로 다시 확정">다시 확정</button>
          )}
          {canLead && confirmed && (
            <button type="button" className="secondary" disabled={busy} onClick={() => {
              if (window.confirm('확정을 풀고 작성 중으로 돌릴까요?')) run(() => onConfirm(id, false))
            }}>확정 해제</button>
          )}
          <button type="button" className="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            수정 이력{revision ? ` (${revision}판)` : ''}
          </button>
        </span>
      </div>
      {confirmed && <p className="status-note">확정된 콘티를 고치면 ‘확정 후 변경’으로 기록되고, 팀원에게 변경 확인이 다시 요청됩니다.</p>}

      {needAck && unseen.length > 0 && (
        <div className="ack-box" role="status">
          <b>{myAck === undefined ? '확정된 콘티를 확인해 주세요' : '확인한 뒤 바뀐 내용이 있습니다'}</b>
          <ul>
            {unseen.slice(0, 12).flatMap((r) => r.changes.map((c, i) => (
              <li key={`${r.revision}-${i}`}><span className="muted">{r.revision}판 · {r.user ? memberName(r.user) : ''}</span> {c}</li>
            )))}
          </ul>
          <button type="button" disabled={busy} onClick={() => run(() => ackSetlist(id, revision))}>변경 확인 ({revision}판까지)</button>
        </div>
      )}

      {open && (
        <div className="history-box">
          {team && confirmed && history?.members?.length > 0 && (
            <div className="ack-list">
              <b>팀원 변경 확인</b>
              <ul>
                {history.members.map((m) => {
                  const a = history.acks.find((x) => sameId(x.user, m._id))
                  const state = !a ? 'none' : a.revision >= revision ? 'latest' : 'old'
                  return (
                    <li key={m._id} className={`ack-${state}`}>
                      {memberName(m)} —{' '}
                      {state === 'latest' ? '최신 판 확인' : state === 'old' ? `${a.revision}판 확인 (이후 ${revision - a.revision}번 변경)` : '아직 확인 안 함'}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {revisions.length === 0 ? (
            <p className="muted">아직 기록된 변경이 없습니다. 이제부터 고치는 내용이 기록됩니다.</p>
          ) : (
            <ol className="history-list">
              {revisions.map((r) => (
                <li key={r.revision} className={r.afterConfirm ? 'is-after-confirm' : ''}>
                  <div className="history-meta">
                    <b>{r.revision}판</b>
                    <span>{r.kind === 'start' ? '기록 시작 전' : `${shortDateTime(r.at)} · ${r.user ? memberName(r.user) : ''}`}</span>
                    {r.afterConfirm && <span className="badge badge-warn">확정 후 변경</span>}
                    {r.revision !== revision && (
                      <button type="button" className="secondary" disabled={busy} onClick={() => restore(r)}>이 판으로 되돌리기</button>
                    )}
                    {r.revision === revision && <span className="badge">지금 판</span>}
                  </div>
                  <ul>{r.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
