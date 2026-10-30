import { useCallback, useEffect, useRef, useState } from 'react'
import PublicServiceOrder from '../components/PublicServiceOrder'
import Icon from '../components/Icon'
import { useParams, useSearchParams } from 'react-router-dom'
import { getPublicSetlist, getPublicCurrentSong, setPublicCurrentSong, releaseLive } from '../api/setlists'
import { assetUrl } from '../api/client'
import { COPYRIGHT_NOTICE } from '../utils/copyright'
import { formatKoreanDate } from '../utils/dates'
import { useSheetViews } from '../components/useSheetViews'
import { SheetPageView, KeyNotice, PageNav } from '../components/SheetPageView'
import { effectiveSheets } from '../utils/sheets'
import { FlowChips } from '../components/FlowEditor'
import LoginForm from '../components/LoginForm'
import { useAuth } from '../context/useAuth'

const POLL_MS = 3000

function getYoutubeEmbedId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

// 이 앱을 새로 받기 전에 저장해 둔 공유 화면 자료에는 sheet가 없을 수 있다 → 예전 칸으로 악보를 만든다
const sheetOf = (song) => song?.sheet || effectiveSheets(song)[0] || null
const firstImage = (song) => sheetOf(song)?.pages?.find((p) => p.type === 'image')?.url

export default function PublicSetlistView() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const [setlist,    setSetlist]    = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0) // 내 화면의 곡
  const [pageIdx,    setPageIdx]    = useState(0) // 곡 안의 쪽
  const [showOrder, setShowOrder] = useState(false)
  // 무대 모드: 어두운 예배당에서 눈부시지 않게 검은 바탕으로 (이 기기에 기억)
  const [stage, setStage] = useState(() => { try { return localStorage.getItem('stageMode') === '1' } catch { return false } })
  function toggleStage() {
    setStage((v) => {
      try { localStorage.setItem('stageMode', v ? '0' : '1') } catch { /* 기억 못 해도 지금 화면에는 적용 */ }
      return !v
    })
  }
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(true)
  const [sheetOnly,     setSheetOnly]     = useState(searchParams.get('view') === 'sheet')
  const [showPageGrid,  setShowPageGrid]  = useState(false)
  const touchStartX = useRef(null)
  // 공유 비밀번호가 걸린 콘티: 한 번 맞히면 이 탭이 열려 있는 동안 기억한다
  const pinKey = `sharePin_${token}`
  const [pin,      setPin]      = useState(() => { try { return sessionStorage.getItem(pinKey) || '' } catch { return '' } })
  const [needPin,  setNeedPin]  = useState(false)
  // 잠긴 링크(팀원 전용): 팀원 계정으로 로그인해야 열린다. 로그인하면 비밀번호도 필요 없다
  const { token: authToken, user: authUser, logout } = useAuth()
  const [needLogin, setNeedLogin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  // 공유 화면은 검색 결과에 넣지 않는다 (서버 헤더가 없는 곳에서 열려도 지켜지게 화면에서도 알린다)
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow, noarchive'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  // ── 실시간 진행 ──
  // follow(인도자 따라가기): 진행자가 넘기면 내 화면도 넘어간다
  // solo(혼자 보기): 내 화면에서만 넘겨 본다. 다른 사람 화면은 바뀌지 않는다
  const [mode, setMode] = useState('follow')
  const [live, setLive] = useState(null)
  const [conn, setConn] = useState('ok') // ok | lost
  const [notice, setNotice] = useState('')
  const modeRef = useRef('follow')
  const liveRef = useRef({ seq: -1, presenterSeq: null, lost: false, index: null })
  const noticeTimer = useRef(null)
  const setlistRef = useRef(null)

  const flash = useCallback((text) => {
    setNotice(text)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 4500)
  }, [])

  function changeMode(next) {
    modeRef.current = next
    setMode(next)
  }

  const loadSetlist = useCallback(() => getPublicSetlist(token, pin).then((data) => {
    setlistRef.current = data
    setSetlist(data)
    setNeedPin(false)
    setNeedLogin(false)
    return data
  }), [token, pin, authToken]) // eslint-disable-line react-hooks/exhaustive-deps -- 로그인하면 다시 불러온다

  useEffect(() => {
    loadSetlist()
      .catch(err => {
        if (err.data?.needLogin) {
          setNeedLogin(true)
        } else if (err.data?.needPin) {
          setNeedPin(true)
          if (err.data.locked) setPinError(err.message)
          else if (pin) setPinError('비밀번호가 맞지 않습니다')
          // 틀린 비밀번호를 기억해 두면 새로고침할 때마다 다시 틀린 것으로 세므로 지운다
          if (pin) { try { sessionStorage.removeItem(pinKey) } catch { /* 무시 */ } }
        } else {
          setError(err.message || '유효하지 않은 링크입니다')
        }
      })
      .finally(() => setLoading(false))
  }, [loadSetlist, pin, pinKey])

  function submitPin(e) {
    e.preventDefault()
    setPinError('')
    try { sessionStorage.setItem(pinKey, pinInput) } catch { /* 저장 못 해도 이번 화면은 열린다 */ }
    setLoading(true)
    setPin(pinInput)
  }

  // 진행 상태를 3초마다 확인한다 (인터넷이 돌아오거나 화면을 다시 보면 바로)
  const hasSetlist = !!setlist
  useEffect(() => {
    if (!hasSetlist) return undefined
    let alive = true
    const poll = async () => {
      try {
        const data = await getPublicCurrentSong(token)
        if (!alive) return
        const prev = liveRef.current
        if (data.seq < prev.seq) return // 늦게 도착한 옛 응답
        if (prev.presenterSeq !== null && data.presenterSeq !== prev.presenterSeq && data.hasPresenter && !data.isPresenter) {
          flash(`진행자가 바뀌었습니다${data.presenterName ? ` (${data.presenterName})` : ''}`)
        } else if (prev.lost) {
          flash(modeRef.current === 'follow' ? '다시 연결됐습니다 · 인도자 위치로 맞췄어요' : '다시 연결됐습니다')
        }
        // 인도자를 따라가는 중이면 진행자의 곡으로 (진행자 본인은 자기가 넘긴 곳 그대로)
        const total = setlistRef.current?.songs?.length || 0
        if (modeRef.current === 'follow' && !data.isPresenter && data.hasPresenter && total) {
          const idx = Math.min(Math.max(0, data.index), total - 1)
          if (idx !== prev.index || prev.lost) {
            setCurrentIdx(idx)
            setPageIdx(0)
          }
        }
        liveRef.current = { seq: data.seq, presenterSeq: data.presenterSeq, lost: false, index: data.index }
        setLive(data)
        setConn('ok')
        // 콘티 내용이 바뀌었으면 새로 받는다
        if (setlistRef.current && data.revision > (setlistRef.current.revision || 0)) {
          loadSetlist().then(() => flash('콘티 내용이 바뀌어 새로 불러왔습니다')).catch(() => {})
        }
      } catch {
        if (!alive) return
        liveRef.current = { ...liveRef.current, lost: true }
        setConn('lost')
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    const onVisible = () => { if (!document.hidden) poll() }
    const onOffline = () => { liveRef.current = { ...liveRef.current, lost: true }; setConn('lost') }
    window.addEventListener('online', poll)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('online', poll)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token, hasSetlist, flash, loadSetlist])

  const presenting = !!live?.isPresenter && !!live?.presenterActive

  // 진행자로서 곡을 넘긴다. 실패하면 이유를 알려 주고 따라가기·혼자 보기로 돌아간다
  async function pushLive(idx, takeover = false) {
    try {
      const data = await setPublicCurrentSong(token, idx, { takeover })
      liveRef.current = { seq: data.seq, presenterSeq: data.presenterSeq, lost: false, index: data.index }
      setLive(data)
      return true
    } catch (err) {
      if (err.status === 409 && err.data?.busy) {
        if (window.confirm(`${err.data.presenterName || '다른 인도자'} 님이 진행 중입니다.\n진행을 넘겨받을까요? 넘겨받으면 ‘인도자 따라가기’ 화면이 모두 내 진행을 따라옵니다.`)) {
          return pushLive(idx, true)
        }
        changeMode('follow')
      } else {
        flash(err.message || '곡을 넘기지 못했습니다')
      }
      return false
    }
  }

  async function startPresenting() {
    if (await pushLive(currentIdx)) {
      changeMode('follow')
      flash('진행을 시작했습니다 · 이제 넘기면 모두의 화면이 따라옵니다')
    }
  }

  async function stopPresenting() {
    if (!live?.setlistId) return
    try {
      const data = await releaseLive(live.setlistId)
      setLive(data)
      flash('진행을 끝냈습니다')
    } catch (err) { flash(err.message) }
  }

  function followLeader() {
    changeMode('follow')
    if (live?.hasPresenter && setlist?.songs?.length) {
      setCurrentIdx(Math.min(Math.max(0, live.index), setlist.songs.length - 1))
      setPageIdx(0)
    }
  }

  // 곡 이동 (쪽 이동과 다르다)
  function handleSelectSong(idx) {
    if (idx < 0 || idx >= (setlist?.songs?.length ?? 0)) return
    setCurrentIdx(idx)
    setPageIdx(0)
    setShowPageGrid(false)
    if (presenting) {
      pushLive(idx)
    } else if (modeRef.current === 'follow') {
      changeMode('solo')
      if (live?.hasPresenter) flash('혼자 보기로 바뀌었습니다 · 내 화면만 넘어가요')
    }
  }

  const songs = setlist?.songs || []
  const song  = songs[currentIdx] || songs[0]
  const views = useSheetViews(sheetOf(song))
  const page = Math.min(pageIdx, Math.max(0, views.length - 1))

  // 넘기기(스와이프·좌우 누르기): 곡 안에 남은 쪽이 있으면 쪽을, 마지막 쪽이면 다음 곡으로
  function step(dir) {
    // PDF를 여는 중에는 쪽 수를 아직 모르므로 곡을 건너뛰지 않는다
    if (views[page]?.loading) { flash('PDF 악보를 여는 중입니다'); return }
    const nextPage = page + dir
    if (nextPage >= 0 && nextPage < views.length) { setPageIdx(nextPage); return }
    const nextSong = currentIdx + dir
    if (nextSong < 0 || nextSong >= songs.length) return
    handleSelectSong(nextSong)
    flash(`${dir > 0 ? '다음' : '이전'} 곡: ${songs[nextSong].title}`)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) step(delta < 0 ? 1 : -1)
    touchStartX.current = null
  }

  if (loading) return (
    <div className="dashboard">
      <div className="card panel">불러오는 중...</div>
    </div>
  )

  if ((needLogin || showLogin) && !authToken) return (
    <div className="share-login">
      <div className="card panel share-login-note">
        <h2>🔒 팀원만 볼 수 있는 콘티입니다</h2>
        <p>이 콘티의 팀 계정으로 로그인하면 열립니다.{!needLogin && ' 로그인하면 비밀번호 없이 열립니다.'}</p>
        {!needLogin && <button type="button" className="secondary" onClick={() => setShowLogin(false)}>비밀번호로 열기</button>}
      </div>
      <LoginForm />
    </div>
  )

  if (needLogin) return (
    <div className="dashboard">
      <div className="card panel pin-gate">
        <h2>🔒 팀원만 볼 수 있는 콘티입니다</h2>
        <p>지금 로그인한 <b>{authUser?.email || '계정'}</b>은 이 콘티를 볼 수 없는 계정입니다. 이 콘티의 팀 계정으로 다시 로그인하거나, 공유한 분에게 팀 초대나 공유 비밀번호를 받아 주세요.</p>
        <button type="button" className="secondary" onClick={() => { logout(); setNeedLogin(false); setShowLogin(true) }}>다른 계정으로 로그인</button>
      </div>
    </div>
  )

  if (needPin) return (
    <div className="dashboard">
      <form className="card panel pin-gate" onSubmit={submitPin}>
        <h2>🔒 비밀번호가 필요한 콘티입니다</h2>
        <p>공유한 분에게 받은 숫자 비밀번호를 입력해 주세요.</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="숫자 비밀번호"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
          autoFocus
        />
        {pinError && <p className="error-text">{pinError}</p>}
        <button type="submit" disabled={pinInput.length < 4}>열기</button>
        {!authToken && <button type="button" className="text-btn" onClick={() => setShowLogin(true)}>팀원이면 로그인해서 열기</button>}
      </form>
    </div>
  )

  if (error) return (
    <div className="dashboard">
      <div className="card panel" style={{ textAlign: 'center', padding: 40 }}>
        <h2>😕</h2><p>{error}</p>
      </div>
    </div>
  )

  const confirmed = setlist.status === 'confirmed'
  const leaderIdx = live?.hasPresenter ? Math.min(Math.max(0, live.index), songs.length - 1) : null

  const liveBar = (
    <LiveBar
      mode={mode}
      conn={conn}
      live={live}
      presenting={presenting}
      leaderIdx={leaderIdx}
      leaderTitle={leaderIdx !== null ? songs[leaderIdx]?.title : ''}
      dark={sheetOnly}
      onFollow={followLeader}
      onSolo={() => changeMode('solo')}
      onStart={startPresenting}
      onStop={stopPresenting}
    />
  )

  return (
    <div className={stage ? 'stage-mode' : undefined} style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg, #f8fafc)' }}>
      {/* 헤더 */}
      <header className="topbar" style={{ flexShrink: 0 }}>
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">
            {[setlist.gigDate && formatKoreanDate(setlist.gigDate), setlist.name].filter(Boolean).join(' · ')}
            <span className={`status-badge ${confirmed ? 'is-confirmed' : 'is-draft'}`} style={{ marginLeft: 8 }}>
              {confirmed ? '확정' : '작성 중'}
            </span>
            {confirmed && setlist.changesAfterConfirm > 0 && <span className="status-changed"> 확정 후 {setlist.changesAfterConfirm}번 변경</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={toggleStage}
            aria-pressed={stage} title={stage ? '밝은 화면으로' : '어두운 무대 모드로'}>
            <Icon name={stage ? 'sun' : 'moon'} />{stage ? '밝게' : '무대 모드'}
          </button>
          {setlist.items?.length > 0 && (
            <button type="button" className="secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setShowOrder((v) => !v)}>
              예배 순서
            </button>
          )}
          <button
            onClick={() => setSheetOnly(v => !v)}
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: sheetOnly ? '#15803d' : '#e2e8f0',
              color: sheetOnly ? '#fff' : '#374151',
            }}
          >
            {sheetOnly ? '📋 전체 보기' : '📄 악보만'}
          </button>
        </div>
      </header>

      {!sheetOnly && liveBar}
      {notice && <div className="live-toast" role="status">{notice}</div>}

      {showOrder && (
        <PublicServiceOrder setlist={setlist} currentIdx={currentIdx} onSelectSong={handleSelectSong} onClose={() => setShowOrder(false)} />
      )}

      {/* 악보만 슬라이드 모드 */}
      {sheetOnly && (
        <div
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#111', position: 'relative' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {liveBar}
          {/* 상단 바: 곡 위치 · 곡 이동 · 쪽 위치 */}
          <div className="sheet-topbar">
            <button type="button" onClick={() => handleSelectSong(currentIdx - 1)} disabled={currentIdx === 0} aria-label="이전 곡">⏮ 곡</button>
            <span className="sheet-pill">
              곡 {currentIdx + 1}/{songs.length} · {song?.title}
              {song?.key && <span style={{ marginLeft: 8, opacity: 0.7 }}>Key {song.key}{song?.capo > 0 ? ` · 카포${song.capo}` : ''}</span>}
              {views.length > 1 && <b className="sheet-pill-page"> · {page + 1}/{views.length}쪽</b>}
            </span>
            <button type="button" onClick={() => handleSelectSong(currentIdx + 1)} disabled={currentIdx === songs.length - 1} aria-label="다음 곡">곡 ⏭</button>
            <button type="button" className={showPageGrid ? 'is-on' : ''} onClick={() => setShowPageGrid(v => !v)}>⊞ 목록</button>
          </div>
          {song && <div className="sheet-key-dock"><KeyNotice song={song} dark compact /></div>}
          {song?.flow?.length > 0 ? (
            <div className="sheet-flow-dock"><span>진행</span><FlowChips flow={song.flow} className="flow-dark" /></div>
          ) : song?.structure ? (
            <div className="sheet-flow-dock"><span>송폼</span><b className="sheet-flow-text">{song.structure}</b></div>
          ) : null}

          <div className="sheet-stage">
          {/* 곡 목록 오버레이 */}
          {showPageGrid && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(0,0,0,0.92)', overflowY: 'auto', padding: '56px 16px 16px', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {songs.map((s, i) => (
                  <div key={s._id} onClick={() => handleSelectSong(i)} style={{ cursor: 'pointer' }}>
                    {firstImage(s) ? (
                      <img
                        src={assetUrl(firstImage(s))}
                        alt={s.title}
                        style={{
                          width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                          borderRadius: 6, display: 'block',
                          border: i === currentIdx ? '2px solid #15803d' : '2px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', aspectRatio: '3/4', background: '#1e293b',
                        borderRadius: 6, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        border: i === currentIdx ? '2px solid #15803d' : '2px solid rgba(255,255,255,0.1)',
                      }}>
                        <span style={{ fontSize: 24 }}>{s.sheet ? '📄' : '🎵'}</span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>{s.sheet ? 'PDF 악보' : '악보 없음'}</span>
                      </div>
                    )}
                    <div style={{ color: i === currentIdx ? '#4ade80' : '#94a3b8', fontSize: 11, marginTop: 5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                      <span style={{ opacity: 0.5, marginRight: 3 }}>{i + 1}</span>{s.title}
                      {leaderIdx === i && <span style={{ marginLeft: 4, color: '#fbbf24' }}>● 인도자</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 악보 한 쪽 — 잘리지 않게 가로 맞춤, 세로 스크롤 */}
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
            <SheetPageView view={views[page]} song={song} shareToken={token} pin={pin} dark
              imgStyle={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }} />
          </div>

          <div className="sheet-bottom">
            <PageNav index={page} total={views.length} onChange={setPageIdx} dark />
          </div>

          {/* 좌우 누르기: 쪽 → 곡 순서로 넘김 */}
          <button
            onClick={() => step(-1)}
            disabled={currentIdx === 0 && page === 0}
            aria-label="이전 (쪽 또는 곡)"
            className="sheet-tap sheet-tap-left"
          >‹</button>
          <button
            onClick={() => step(1)}
            disabled={currentIdx === songs.length - 1 && page >= views.length - 1}
            aria-label="다음 (쪽 또는 곡)"
            className="sheet-tap sheet-tap-right"
          >›</button>

          {/* 하단 점: 곡 위치 */}
          {songs.length <= 12 && (
            <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 5, pointerEvents: 'none' }}>
              {songs.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIdx ? 18 : 7, height: 7, borderRadius: 4, transition: 'width 0.2s, background 0.2s',
                    background: i === currentIdx ? '#fff' : i === leaderIdx ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* 데스크톱: 2컬럼 / 모바일: 스택 */}
      {!sheetOnly && <div className="share-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* 사이드 곡 목록 (데스크톱에서만 보임) */}
        <aside className="share-sidebar">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
            곡 목록 <span style={{ fontWeight: 400, color: '#94a3b8' }}>{songs.length}곡</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto' }}>
            {songs.map((s, idx) => (
              <li
                key={s._id}
                onClick={() => handleSelectSong(idx)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  background: idx === currentIdx ? '#f0fdf4' : 'transparent',
                  borderLeft: `3px solid ${idx === currentIdx ? '#15803d' : 'transparent'}`,
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: idx === currentIdx ? 700 : 400, color: idx === currentIdx ? '#14532d' : '#1e293b' }}>
                  <span style={{ color: '#94a3b8', marginRight: 5, fontSize: 11 }}>{idx + 1}</span>
                  {s.title}
                  {leaderIdx === idx && <span className="leader-dot" title="인도자가 진행 중인 곡">● 인도자</span>}
                </div>
                {(s.key || s.bpm > 0) && (
                  <div style={{ marginTop: 3 }}>
                    {s.key   && <span className="badge badge-key" style={{ fontSize: 10 }}>{s.key}</span>}
                    {s.capo > 0 && <span className="badge" style={{ fontSize: 10, marginLeft: 3, background: '#fef9c3', color: '#854d0e' }}>카포{s.capo}</span>}
                    {s.bpm > 0 && <span className="badge badge-bpm" style={{ fontSize: 10, marginLeft: 3 }}>{s.bpm}</span>}
                    {s.keyState === 'mismatch' && <span className="badge sheet-badge sheet-mismatch" style={{ fontSize: 10, marginLeft: 3 }}>악보 {s.sheet.key}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* 메인 콘텐츠 */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {song
            ? <SongContent
                song={song}
                views={views}
                page={page}
                onPage={setPageIdx}
                shareToken={token}
                pin={pin}
                currentIdx={currentIdx}
                totalSongs={songs.length}
                onStep={step}
              />
            : <div className="card panel"><p className="muted">곡이 없습니다</p></div>
          }
        </main>
      </div>}

      {/* 모바일 하단 슬라이더 (전체 보기 모드에서만) */}
      {!sheetOnly && (
        <MobileSongSlider
          songs={songs}
          currentIdx={currentIdx}
          leaderIdx={leaderIdx}
          onSelect={handleSelectSong}
        />
      )}

      <style>{`
        .share-layout {
          display: flex;
          gap: 16px;
          padding: 16px;
        }
        .share-sidebar {
          width: 200px;
          flex-shrink: 0;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          align-self: flex-start;
          max-height: calc(100dvh - 120px);
          display: flex;
          flex-direction: column;
        }
        .share-sidebar ul { flex: 1; overflow-y: auto; }
        .mobile-song-bar { display: none; }

        @media (max-width: 640px) {
          .share-layout { padding: 8px; gap: 0; flex-direction: column; }
          .share-sidebar { display: none; }
          .share-layout main { padding: 0; overflow-y: visible; }
          .mobile-song-bar { display: flex; }
        }
      `}</style>
      {!sheetOnly && <p className="share-copyright">{COPYRIGHT_NOTICE} <a href="/copyright">저작권 신고·문의</a></p>}
    </div>
  )
}

/* ── 실시간 진행 막대: 지금 모드(따라가기/혼자 보기)와 연결 상태 ───────────── */
function LiveBar({ mode, conn, live, presenting, leaderIdx, leaderTitle, dark, onFollow, onSolo, onStart, onStop }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  let status
  if (conn === 'lost') {
    status = <span className="live-dot off">{offline ? '인터넷 끊김' : '연결 끊김'} · 실시간 동기화가 멈췄습니다. 다시 연결 중…</span>
  } else if (presenting) {
    status = <span className="live-dot on">🎤 내가 진행 중 · 넘기면 따라가는 모든 화면이 바뀝니다</span>
  } else if (!live?.hasPresenter) {
    status = <span className="live-dot idle">연결됨 · 아직 진행 중인 인도자가 없어요</span>
  } else if (!live.presenterActive) {
    status = <span className="live-dot idle">인도자 신호 없음 · 마지막 위치 {leaderIdx + 1}번 곡</span>
  } else if (mode === 'follow') {
    status = <span className="live-dot on">인도자 따라가는 중 · {leaderIdx + 1}번 곡 {leaderTitle}</span>
  } else {
    status = <span className="live-dot solo">혼자 보는 중 · 인도자는 {leaderIdx + 1}번 곡 {leaderTitle}</span>
  }

  return (
    <div className={`live-bar${dark ? ' is-dark' : ''}`}>
      <div className="live-modes" role="group" aria-label="보기 방식">
        <button type="button" className={mode === 'follow' ? 'is-on' : ''} aria-pressed={mode === 'follow'} onClick={onFollow}>인도자 따라가기</button>
        <button type="button" className={mode === 'solo' ? 'is-on' : ''} aria-pressed={mode === 'solo'} onClick={onSolo}>혼자 보기</button>
      </div>
      {status}
      {live?.canPresent && !presenting && (
        <button type="button" className="live-present" onClick={onStart}>
          {live.hasPresenter && live.presenterActive ? '진행 넘겨받기' : '내가 진행하기'}
        </button>
      )}
      {presenting && <button type="button" className="live-present secondary" onClick={onStop}>진행 끝내기</button>}
      {live && !live.canPresent && <span className="live-hint">내가 곡을 넘겨도 다른 사람 화면은 바뀌지 않아요</span>}
    </div>
  )
}

/* ── 모바일 하단 곡 슬라이더 ─────────────────────────────── */
function MobileSongSlider({ songs, currentIdx, leaderIdx, onSelect }) {
  const sliderRef = useRef(null)

  // 현재 곡이 바뀌면 자동으로 해당 항목이 보이도록 스크롤
  useEffect(() => {
    const el = sliderRef.current?.querySelector(`[data-idx="${currentIdx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentIdx])

  function prev() { if (currentIdx > 0) onSelect(currentIdx - 1) }
  function next() { if (currentIdx < songs.length - 1) onSelect(currentIdx + 1) }

  return (
    <div
      className="mobile-song-bar"
      style={{
        flexShrink: 0,
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* ← 이전 곡 */}
      <button
        onClick={prev}
        disabled={currentIdx === 0}
        aria-label="이전 곡"
        style={{
          flexShrink: 0, width: 44, border: 'none', background: 'transparent',
          fontSize: 20, color: currentIdx === 0 ? '#cbd5e1' : '#15803d', cursor: 'pointer',
        }}
      >‹</button>

      {/* 가로 스크롤 곡 목록 */}
      <div
        ref={sliderRef}
        style={{
          flex: 1, overflowX: 'auto', display: 'flex', gap: 6,
          alignItems: 'center', padding: '10px 4px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {songs.map((s, idx) => (
          <button
            key={s._id}
            data-idx={idx}
            aria-current={idx === currentIdx ? 'true' : undefined}
            onClick={() => onSelect(idx)}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              borderRadius: 20,
              border: idx === leaderIdx && idx !== currentIdx ? '2px solid #d97706' : 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: idx === currentIdx ? 700 : 400,
              background: idx === currentIdx ? '#15803d' : '#f1f5f9',
              color: idx === currentIdx ? '#fff' : '#374151',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ opacity: 0.6, marginRight: 4, fontSize: 11 }}>{idx + 1}</span>
            {s.title}
            {s.key && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>{s.key}</span>
            )}
          </button>
        ))}
      </div>

      {/* → 다음 곡 */}
      <button
        onClick={next}
        disabled={currentIdx === songs.length - 1}
        aria-label="다음 곡"
        style={{
          flexShrink: 0, width: 44, border: 'none', background: 'transparent',
          fontSize: 20, color: currentIdx === songs.length - 1 ? '#cbd5e1' : '#15803d', cursor: 'pointer',
        }}
      >›</button>
    </div>
  )
}

/* ── 악보 콘텐츠 (줌 컨트롤 + 쪽 넘기기) ──────────────────────────── */
function SongContent({ song, views, page, onPage, shareToken, pin, currentIdx = 0, totalSongs = 1, onStep }) {
  const [scale, setScale]     = useState(1)
  const [fitted, setFitted]   = useState(true)   // true = 세로 맞춤(전체 보기), false = 가로 스케일
  const [toolbarHost, setToolbarHost] = useState(null) // 악보 위 필기 도구 막대 자리
  const [zoomFor, setZoomFor] = useState(song._id)
  const touchStartX = useRef(null)
  const youtubeId = getYoutubeEmbedId(song.youtubeUrl)
  const view = views[page]

  // 곡이 바뀌면 맞춤 모드로 초기화
  if (zoomFor !== song._id) { setZoomFor(song._id); setFitted(true); setScale(1) }

  function handleFit()  { setFitted(true);  setScale(1) }
  function handleMinus(){ setFitted(false); setScale(s => Math.max(0.4, +(s - 0.2).toFixed(1))) }
  function handlePlus() { setFitted(false); setScale(s => Math.min(3,   +(s + 0.2).toFixed(1))) }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) onStep(delta < 0 ? 1 : -1)
    touchStartX.current = null
  }

  const hasSheet = views.length > 0
  const atStart = currentIdx === 0 && page === 0
  const atEnd = currentIdx === totalSongs - 1 && page >= views.length - 1

  return (
    <div className="card panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{song.title}</h2>
          {song.artist && <p className="muted" style={{ margin: '4px 0 0' }}>{song.artist}</p>}
        </div>
        <div className="badge-row">
          {song.key    && <span className="badge badge-key">🎵 {song.key}</span>}
          {song.capo > 0 && <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>카포 {song.capo}프렛</span>}
          {song.bpm > 0 && <span className="badge badge-bpm">♩ {song.bpm} BPM</span>}
        </div>
      </div>

      {song.flow?.length > 0 ? (
        <div className="viewer-flow"><strong>진행</strong><FlowChips flow={song.flow} /></div>
      ) : song.structure ? (
        <div className="viewer-flow"><strong>송폼</strong><span className="viewer-flow-text">{song.structure}</span></div>
      ) : null}

      {song.notes && (
        <div className="viewer-notes" style={{ marginBottom: 16 }}>
          <strong>메모</strong>
          <p style={{ margin: '4px 0 0' }}>{song.notes}</p>
        </div>
      )}

      {hasSheet && (
        <div className="viewer-section">
          <KeyNotice song={song} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>악보</h3>
            <span className="muted" style={{ fontSize: 12 }}>
              {song.sheet?.key ? `${song.sheet.key} 악보` : 'Key 미확인 악보'}{song.sheet?.label ? ` · ${song.sheet.label}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', alignItems: 'center' }}>
              <button
                className="secondary"
                style={{ fontSize: 12, padding: '4px 10px', fontWeight: fitted ? 700 : 400, background: fitted ? '#15803d' : undefined, color: fitted ? '#fff' : undefined, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                onClick={handleFit}
                title="악보 전체를 세로로 맞춤"
              >맞춤</button>
              <button className="secondary" style={{ fontSize: 16, padding: '4px 10px', lineHeight: 1 }} onClick={handleMinus} title="축소">−</button>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 36, textAlign: 'center', lineHeight: '32px' }}>
                {fitted ? '맞춤' : `${Math.round(scale * 100)}%`}
              </span>
              <button className="secondary" style={{ fontSize: 16, padding: '4px 10px', lineHeight: 1 }} onClick={handlePlus} title="확대">+</button>
            </div>
          </div>
          <PageNav index={page} total={views.length} onChange={onPage} />
          <div ref={setToolbarHost} />

          {fitted ? (
            /* 세로 맞춤: 컨테이너 높이에 이미지 전체가 들어오도록 */
            <div
              style={{ position: 'relative', height: 'calc(100dvh - 300px)', minHeight: 200, overflow: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex' }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <SheetPageView view={view} song={song} shareToken={shareToken} pin={pin} toolbarHost={toolbarHost}
                wrapStyle={{ height: '100%', flexShrink: 0, margin: '0 auto' /* 넓은 악보도 왼쪽이 잘리지 않게 (가운데 정렬 + 스크롤) */ }}
                imgStyle={{ height: '100%', width: 'auto', maxWidth: 'none', display: 'block', objectFit: 'contain' }} />
              {!atStart && (
                <button onClick={() => onStep(-1)} className="sheet-edge sheet-edge-left" title={page > 0 ? '이전 쪽' : '이전 곡'}>‹</button>
              )}
              {!atEnd && (
                <button onClick={() => onStep(1)} className="sheet-edge sheet-edge-right" title={page < views.length - 1 ? '다음 쪽' : '다음 곡'}>›</button>
              )}
              <div className="sheet-corner">
                곡 {currentIdx + 1}/{totalSongs}{views.length > 1 ? ` · ${page + 1}/${views.length}쪽` : ''}
              </div>
            </div>
          ) : (
            /* 가로 스케일 모드 */
            <div style={{ overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <SheetPageView view={view} song={song} shareToken={shareToken} pin={pin} toolbarHost={toolbarHost}
                wrapStyle={{ width: `${scale * 100}%` }} imgClassName="sheet-image"
                imgStyle={{ display: 'block', width: '100%', maxWidth: 'none' }} />
            </div>
          )}
          {view?.type === 'pdf' && view.openUrl && (
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              PDF 악보 {view.pdfPage}/{view.pdfTotal}쪽 · <a href={view.openUrl} target="_blank" rel="noopener noreferrer">PDF 원본 열기</a>
            </p>
          )}
        </div>
      )}

      {youtubeId && (
        <div className="viewer-section">
          <h3>YouTube</h3>
          <div className="youtube-wrap">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {song.mrUrl && (
        <div className="viewer-section">
          <h3>MR / 반주</h3>
          <a href={song.mrUrl} target="_blank" rel="noopener noreferrer" className="link-btn">🎧 MR 열기</a>
        </div>
      )}

      {!youtubeId && !song.mrUrl && !hasSheet && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>등록된 악보·링크가 없습니다</p>
      )}
    </div>
  )
}
