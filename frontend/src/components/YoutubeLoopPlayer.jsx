import { useEffect, useRef, useState } from 'react'
import './YoutubeLoopPlayer.css'

// ── 유튜브 주소에서 영상 id 꺼내기 ──────────────────────
// youtu.be/ID, watch?v=ID, shorts/ID, embed/ID, live/ID, 영상 id만 붙여넣은 경우 모두 받는다
const ID_RE = /^[A-Za-z0-9_-]{11}$/

function parseYouTubeId(input) {
  const text = (input || '').trim()
  if (!text) return ''
  if (ID_RE.test(text)) return text
  let url
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return ''
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id = ''
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] || ''
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v') || ''
    else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/)
      if (m) id = m[2]
    }
  }
  return ID_RE.test(id) ? id : ''
}

// ── 유튜브 플레이어 API 불러오기 (한 번만) ─────────────────
let apiPromise = null

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => { apiPromise = null; reject(new Error('youtube api')) }
    document.head.appendChild(s)
  })
  return apiPromise
}

// 초 → m:ss
function fmt(sec) {
  if (sec == null || !isFinite(sec)) return '-:--'
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const SPEEDS = [0.5, 0.75, 1, 1.25]

const ERROR_TEXT = {
  2: '영상 주소가 올바르지 않아요.',
  5: '이 영상은 여기서 재생할 수 없어요.',
  100: '영상을 찾을 수 없어요. 삭제되었거나 비공개일 수 있어요.',
  101: '영상 주인이 다른 사이트에서 재생하지 못하게 막아 두었어요. 유튜브 앱에서 열어 주세요.',
  150: '영상 주인이 다른 사이트에서 재생하지 못하게 막아 두었어요. 유튜브 앱에서 열어 주세요.',
}

// ── 구간 반복 연습 플레이어 ─────────────────────────────
export default function YoutubeLoopPlayer({ songs = [] }) {
  const ytSongs = songs.filter(s => s?.youtubeUrl && parseYouTubeId(s.youtubeUrl))

  const [input, setInput] = useState('')
  const [songId, setSongId] = useState('')
  const [videoId, setVideoId] = useState('')
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pointA, setPointA] = useState(null)
  const [pointB, setPointB] = useState(null)
  const [loopOn, setLoopOn] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')

  const hostRef = useRef(null) // 플레이어가 들어갈 자리 (안쪽 div는 유튜브가 iframe으로 바꾼다)
  const playerRef = useRef(null)

  const loopValid = pointA != null && pointB != null && pointB > pointA

  // 새 영상 고르기: 구간·속도는 처음부터
  function openVideo(id) {
    setError('')
    setPointA(null); setPointB(null); setLoopOn(false)
    setCurrent(0); setDuration(0); setSpeed(1); setPlaying(false)
    setVideoId(id)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const id = parseYouTubeId(input)
    if (!id) { setError('유튜브 주소를 확인해 주세요. (예: https://youtu.be/…)'); return }
    setSongId('')
    openVideo(id)
  }

  function handlePickSong(e) {
    const id = e.target.value
    setSongId(id)
    const song = ytSongs.find(s => s._id === id)
    if (!song) return
    setInput(song.youtubeUrl)
    openVideo(parseYouTubeId(song.youtubeUrl))
  }

  // 영상 불러오기 (처음엔 플레이어를 만들고, 그 다음부턴 영상만 바꾼다)
  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        if (playerRef.current) {
          playerRef.current.cueVideoById(videoId)
          playerRef.current.setPlaybackRate?.(1)
          return
        }
        const el = document.createElement('div')
        hostRef.current.appendChild(el)
        playerRef.current = new YT.Player(el, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => setReady(true),
            onStateChange: (e) => setPlaying(e.data === YT.PlayerState.PLAYING),
            onPlaybackRateChange: (e) => setSpeed(e.data),
            onError: (e) => setError(ERROR_TEXT[e.data] || '영상을 재생할 수 없어요.'),
          },
        })
      })
      .catch(() => {
        if (!cancelled) setError('유튜브를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')
      })
    return () => { cancelled = true }
  }, [videoId])

  // 화면을 떠나면 플레이어 정리
  useEffect(() => () => {
    try { playerRef.current?.destroy() } catch { /* 무시 */ }
    playerRef.current = null
  }, [])

  // 0.2초마다 현재 위치 확인 → B 지점을 지나면 A 지점으로 돌아간다
  useEffect(() => {
    if (!ready) return
    const timer = setInterval(() => {
      const p = playerRef.current
      if (!p?.getCurrentTime) return
      const t = p.getCurrentTime() || 0
      setCurrent(t)
      const d = p.getDuration?.() || 0
      if (d) setDuration(d)
      if (loopOn && loopValid && t >= pointB) p.seekTo(pointA, true)
    }, 200)
    return () => clearInterval(timer)
  }, [ready, loopOn, loopValid, pointA, pointB])

  const player = () => (ready ? playerRef.current : null)

  function togglePlay() {
    const p = player(); if (!p) return
    if (playing) p.pauseVideo(); else p.playVideo()
  }

  function seekBy(delta) {
    const p = player(); if (!p) return
    const d = p.getDuration?.() || Infinity
    const t = Math.min(d, Math.max(0, (p.getCurrentTime() || 0) + delta))
    p.seekTo(t, true)
    setCurrent(t)
  }

  function markA() {
    const p = player(); if (!p) return
    const t = p.getCurrentTime() || 0
    setPointA(t)
    if (pointB != null && pointB <= t) { setPointB(null); setLoopOn(false) }
  }

  function markB() {
    const p = player(); if (!p) return
    const t = p.getCurrentTime() || 0
    if (pointA != null && t <= pointA) { setError('B 지점은 A 지점보다 뒤여야 해요.'); return }
    setError('')
    setPointB(t)
  }

  function toggleLoop() {
    if (!loopValid) return
    const next = !loopOn
    setLoopOn(next)
    const p = player()
    // 반복을 켤 때 구간 밖이면 A 지점으로 이동
    if (next && p) {
      const t = p.getCurrentTime() || 0
      if (t < pointA || t >= pointB) p.seekTo(pointA, true)
    }
  }

  function clearLoop() {
    setPointA(null); setPointB(null); setLoopOn(false); setError('')
  }

  function changeSpeed(rate) {
    const p = player(); if (!p) return
    p.setPlaybackRate(rate)
    setSpeed(rate)
  }

  const disabled = !ready || !videoId

  return (
    <div className="card panel yt-loop">
      <h3 style={{ marginTop: 0 }}>🔁 구간 반복 연습</h3>
      <p className="yt-loop-help">
        유튜브 영상에서 어려운 부분만 골라 반복해서 들을 수 있어요. 원하는 곳에서 <b>A 지점</b>, 끝나는 곳에서 <b>B 지점</b>을 누른 뒤 <b>구간 반복</b>을 켜세요.
      </p>

      {ytSongs.length > 0 && (
        <label className="yt-loop-field">
          <span>곡 목록에서 고르기</span>
          <select value={songId} onChange={handlePickSong}>
            <option value="">— 유튜브 링크가 있는 곡 {ytSongs.length}개 —</option>
            {ytSongs.map(s => (
              <option key={s._id} value={s._id}>
                {s.title}{s.key ? ` (${s.key})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <form className="yt-loop-url" onSubmit={handleSubmit}>
        <input
          type="text"
          inputMode="url"
          placeholder="유튜브 주소 붙여넣기"
          value={input}
          onChange={e => setInput(e.target.value)}
          aria-label="유튜브 주소"
        />
        <button type="submit">불러오기</button>
      </form>

      {error && <p className="yt-loop-error">{error}</p>}

      <div className={`yt-loop-video ${videoId ? '' : 'is-empty'}`}>
        <div ref={hostRef} className="yt-loop-host" />
        {!videoId && <div className="yt-loop-placeholder">영상을 불러오면 여기에 나와요</div>}
      </div>

      <div className="yt-loop-time">
        <span className="yt-loop-now">{fmt(current)}</span>
        <span className="yt-loop-total"> / {fmt(duration)}</span>
      </div>

      <div className="yt-loop-row">
        <button type="button" className="secondary" onClick={() => seekBy(-5)} disabled={disabled}>⏪ 5초</button>
        <button type="button" className="yt-loop-play" onClick={togglePlay} disabled={disabled}>
          {playing ? '⏸ 일시정지' : '▶ 재생'}
        </button>
        <button type="button" className="secondary" onClick={() => seekBy(5)} disabled={disabled}>5초 ⏩</button>
      </div>

      <div className="yt-loop-row">
        <button type="button" className={`yt-loop-mark ${pointA != null ? 'is-set' : ''}`} onClick={markA} disabled={disabled}>
          A 지점<small>{pointA != null ? fmt(pointA) : '지금 위치'}</small>
        </button>
        <button type="button" className={`yt-loop-mark ${pointB != null ? 'is-set' : ''}`} onClick={markB} disabled={disabled}>
          B 지점<small>{pointB != null ? fmt(pointB) : '지금 위치'}</small>
        </button>
      </div>

      <div className="yt-loop-row">
        <button
          type="button"
          className={`yt-loop-toggle ${loopOn ? 'is-on' : ''}`}
          onClick={toggleLoop}
          disabled={disabled || !loopValid}
          aria-pressed={loopOn}
        >
          {loopOn ? '🔁 구간 반복 켜짐' : '🔁 구간 반복 꺼짐'}
        </button>
        {(pointA != null || pointB != null) && (
          <button type="button" className="secondary" onClick={clearLoop}>구간 지우기</button>
        )}
      </div>
      {!loopValid && videoId && (
        <p className="yt-loop-hint">A 지점과 B 지점을 모두 정하면 구간 반복을 켤 수 있어요.</p>
      )}

      <div className="yt-loop-speeds" role="group" aria-label="재생 속도">
        <span>속도</span>
        {SPEEDS.map(r => (
          <button
            key={r}
            type="button"
            className={speed === r ? 'is-on' : ''}
            onClick={() => changeSpeed(r)}
            disabled={disabled}
            aria-pressed={speed === r}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}
