import { useCallback, useEffect, useRef, useState } from 'react'
import { getLive, setCurrentSong, releaseLive } from '../api/setlists'

const POLL_MS = 3000

// 콘티 화면의 실시간 진행 상자
// - 인도 권한(팀장·인도 배정자·개인 콘티 주인)이 있으면 '진행 시작' 후 곡을 넘기면 모든 공유 화면이 따라온다
// - 권한이 없으면 지금 누가 몇 번 곡을 진행 중인지만 보여 준다
// onStatus({ online, live }) — 준비 점검에 연결 상태를 알려 준다
export default function LiveControl({ setlist, songs, onStatus }) {
  const [live, setLive] = useState(null)
  const [conn, setConn] = useState('ok') // ok | lost
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const seqRef = useRef(-1)
  const id = setlist._id

  const apply = useCallback((data) => {
    if (data.seq < seqRef.current) return // 늦게 도착한 옛 응답
    seqRef.current = data.seq
    setLive(data)
  }, [])

  useEffect(() => {
    let alive = true
    seqRef.current = -1
    setLive(null)
    setMsg('')
    const poll = async () => {
      try {
        const data = await getLive(id)
        if (!alive) return
        apply(data)
        setConn('ok')
      } catch {
        if (alive) setConn('lost')
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    const onOnline = () => poll()
    const onOffline = () => setConn('lost')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [id, apply])

  useEffect(() => { onStatus?.({ online: conn === 'ok', live }) }, [conn, live, onStatus])

  async function go(index, takeover = false) {
    if (index < 0 || index >= songs.length) return
    setBusy(true)
    setMsg('')
    try {
      apply(await setCurrentSong(id, index, { takeover }))
    } catch (err) {
      if (err.status === 409 && err.data?.busy) {
        if (window.confirm(`${err.data.presenterName || '다른 인도자'} 님이 진행 중입니다.\n진행을 넘겨받을까요? 넘겨받으면 모두의 화면이 내 진행을 따라옵니다.`)) {
          setBusy(false)
          return go(index, true)
        }
      } else {
        setMsg(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    try { apply(await releaseLive(id)) } catch (err) { setMsg(err.message) }
  }

  if (!live) return null
  const idx = Math.min(live.index, Math.max(0, songs.length - 1))
  const song = songs[idx]
  const presenting = live.isPresenter && live.presenterActive
  const leadNames = (live.leaders?.leads || []).map((l) => l.email).join(', ')

  return (
    <div className={`live-box${presenting ? ' is-presenting' : ''}`}>
      <div className="live-head">
        <b>실시간 진행</b>
        <span className={`live-dot ${conn === 'ok' ? 'on' : 'off'}`}>
          {conn === 'ok' ? '연결됨' : '연결 끊김 · 다시 연결 중…'}
        </span>
      </div>

      {presenting ? (
        <div className="live-controls">
          <button type="button" onClick={() => go(idx - 1)} disabled={busy || idx === 0} aria-label="이전 곡">‹</button>
          <div className="live-now">
            <small>내가 진행 중 · {idx + 1} / {songs.length}곡 — 넘기면 ‘인도자 따라가기’ 화면이 모두 바뀝니다</small>
            <strong>{song?.title || '—'}</strong>
            {song?.displayKey && <small>Key {song.displayKey}{song.bpm > 0 ? ` · ${song.bpm} BPM` : ''}</small>}
          </div>
          <button type="button" onClick={() => go(idx + 1)} disabled={busy || idx >= songs.length - 1} aria-label="다음 곡">›</button>
        </div>
      ) : (
        <p className="live-state">
          {live.hasPresenter
            ? <>{live.presenterName || '인도자'} 님이 진행{live.presenterActive ? ' 중' : '했음 (신호 끊김, 마지막 위치 유지)'} · <b>{idx + 1}번 곡 {song?.title || ''}</b></>
            : <>진행 중인 인도자가 없습니다. 공유 화면은 각자 넘겨 봅니다.</>}
        </p>
      )}

      <div className="live-actions">
        {live.canPresent && !presenting && (
          <button type="button" onClick={() => go(idx)} disabled={busy || !songs.length}>
            {live.hasPresenter && live.presenterActive && !live.isPresenter ? '진행 넘겨받기' : '진행 시작'}
          </button>
        )}
        {presenting && <button type="button" className="secondary" onClick={stop}>진행 끝내기</button>}
        <span className="muted live-who">
          진행 권한: {setlist.team ? `팀장${leadNames ? `, 인도 배정 ${leadNames}` : ''} (팀원 배정에서 ‘인도’로 정하면 권한이 생깁니다)` : '나'}
        </span>
      </div>
      {msg && <p className="error-text">{msg}</p>}
    </div>
  )
}
