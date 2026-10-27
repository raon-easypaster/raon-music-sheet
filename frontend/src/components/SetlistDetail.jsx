import { useEffect, useMemo, useState, useRef } from 'react'
import { getPublicCurrentSong, setCurrentSong } from '../api/setlists'
import { sortSongs, filterSongs, KEY_ORDER } from '../utils/songSort'
import FavoriteStar from './FavoriteStar'
import PrintView from './PrintView'
import { formatKoreanDate, isoToDateInput, addDays, nextSunday } from '../utils/dates'

const PICKER_SORTS = [
  { value: 'key',    label: '코드순' },
  { value: 'title',  label: '제목순' },
  { value: 'artist', label: '아티스트순' },
]
const PICKER_VIEW_KEY = 'songPickerView'

function loadPickerView() {
  try { return localStorage.getItem(PICKER_VIEW_KEY) === 'card' ? 'card' : 'list' } catch { return 'list' }
}

function getYoutubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

export default function SetlistDetail({
  setlist,
  songs,
  onAddSongs,
  onToggleFavorite,
  onRemoveSong,
  onReorder,
  onShare,
  onUpdateSetlist,
  onDuplicate,
  onSongSettings,
  onSharePin,
}) {
  const [selectedSongIds, setSelectedSongIds] = useState([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerSort, setPickerSort] = useState('key')
  const [pickerKey, setPickerKey] = useState('') // 코드순일 때 고른 코드 ('' = 전체)
  const [pickerFavOnly, setPickerFavOnly] = useState(false)
  const [pickerView, setPickerView] = useState(loadPickerView)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shareLink,     setShareLink]     = useState(null)
  const [shareToken,    setShareToken]    = useState(null)
  const [conductorIdx,  setConductorIdx]  = useState(0)
  const [copied,        setCopied]        = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)
  const [showPlayer,    setShowPlayer]    = useState(false)
  const [playerIdx,     setPlayerIdx]     = useState(0)
  const [practiced,     setPracticed]     = useState({})
  const [showPrint,     setShowPrint]     = useState(false)
  const [settingsSong,  setSettingsSong]  = useState(null)   // Key·메모를 고치는 중인 곡
  const [settingsForm,  setSettingsForm]  = useState({ key: '', notes: '' })
  const [pinInput,      setPinInput]      = useState('')
  const [pinMsg,        setPinMsg]        = useState('')

  // drag state
  const dragIndex = useRef(null)
  const [localSongs, setLocalSongs] = useState([])

  // 콘티가 바뀌면 공유 상태 초기화
  useEffect(() => {
    setSelectedSongIds([])
    setError('')
    setShareLink(null)
    setShareToken(null)
    setConductorIdx(0)
    setShowPlayer(false)
    setPlayerIdx(0)
    setShowPrint(false)
    setSettingsSong(null)
    setPinInput('')
    setPinMsg('')
    // 연습완료 localStorage 복원
    if (setlist?._id) {
      try {
        const saved = localStorage.getItem(`practiced_${setlist._id}`)
        setPracticed(saved ? JSON.parse(saved) : {})
      } catch { setPracticed({}) }
    }
  }, [setlist?._id])

  // 저장 후 다시 불러온 곡 목록은 화면 상태(공유 링크 등)를 건드리지 않고 반영한다
  useEffect(() => {
    setLocalSongs(setlist?.songs ? setlist.songs.filter(s => typeof s !== 'string') : [])
  }, [setlist?.songs])

  function togglePracticed(songId) {
    if (!setlist?._id) return
    setPracticed(prev => {
      const next = { ...prev, [songId]: !prev[songId] }
      try { localStorage.setItem(`practiced_${setlist._id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const existingSongIds = useMemo(() => {
    if (!setlist?.songs) return []
    return setlist.songs.map((song) => (typeof song === 'string' ? song : song._id))
  }, [setlist])

  // 이 콘티에서만 쓰는 Key·메모 (곡 원본은 그대로)
  const settingsMap = useMemo(
    () => new Map((setlist?.songSettings || []).map((s) => [String(s.song), s])),
    [setlist]
  )
  const displaySongs = useMemo(
    () => localSongs.map((s) => {
      const own = settingsMap.get(s._id)
      return { ...s, displayKey: own?.key || s.key, keyOverridden: !!own?.key, displayNotes: own?.notes || '' }
    }),
    [localSongs, settingsMap]
  )

  const availableSongs = useMemo(() => {
    return songs.filter((song) => !existingSongIds.includes(song._id))
  }, [songs, existingSongIds])

  // 코드순일 때 위에 나열할 코드: 실제로 곡이 있는 코드만, 곡 수와 함께
  // 검색어·즐겨찾기 조건을 먼저 적용한 목록 (코드 버튼의 곡 수도 이 기준)
  const pickerBase = useMemo(() => {
    const searched = filterSongs(availableSongs, pickerSearch)
    return pickerFavOnly ? searched.filter((s) => s.isFavorite) : searched
  }, [availableSongs, pickerSearch, pickerFavOnly])

  const pickerKeyCounts = useMemo(() => {
    const counts = new Map()
    for (const song of pickerBase) {
      const key = song.key || ''
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const known = KEY_ORDER.filter((k) => counts.has(k)).map((k) => [k, counts.get(k)])
    const others = [...counts].filter(([k]) => k && !KEY_ORDER.includes(k))
    const none = counts.has('') ? [['', counts.get('')]] : []
    return [...known, ...others, ...none.map(([, n]) => ['none', n])]
  }, [pickerBase])

  const pickerSongs = useMemo(() => {
    let list = pickerBase
    if (pickerSort === 'key' && pickerKey) {
      list = list.filter((song) => (pickerKey === 'none' ? !song.key : song.key === pickerKey))
    }
    return sortSongs(list, pickerSort)
  }, [pickerBase, pickerSort, pickerKey])

  function changePickerView(view) {
    setPickerView(view)
    try { localStorage.setItem(PICKER_VIEW_KEY, view) } catch { /* 저장 못 해도 이번 화면에는 적용됨 */ }
  }

  function toggleSong(songId) {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    )
  }

  async function handleAddSongs() {
    if (!setlist || selectedSongIds.length === 0) return
    setError('')
    setSubmitting(true)
    try {
      await onAddSongs(setlist._id, selectedSongIds)
      setSelectedSongIds([])
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveSong(songId) {
    if (!setlist) return
    setError('')
    setSubmitting(true)
    try {
      await onRemoveSong(setlist._id, songId)
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Drag-and-drop handlers
  function handleDragStart(idx) {
    dragIndex.current = idx
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    if (dragIndex.current === null || dragIndex.current === idx) return
    const updated = [...localSongs]
    const [moved] = updated.splice(dragIndex.current, 1)
    updated.splice(idx, 0, moved)
    dragIndex.current = idx
    setLocalSongs(updated)
  }

  async function handleDrop() {
    if (!setlist || !onReorder) return
    dragIndex.current = null
    try {
      await onReorder(setlist._id, localSongs.map(s => s._id))
    } catch (err) {
      setError(err.message || 'Reorder failed')
    }
  }

  async function handleShare() {
    if (!onShare) return
    try {
      const { shareToken: token } = await onShare(setlist._id)
      const link = `${window.location.origin}/share/${token}`
      setShareLink(link)
      setShareToken(token)
    } catch (err) {
      setError(err.message || '링크 생성 실패')
    }
  }

  // 공유 중일 때 현재 진행 인덱스 폴링 (3초)
  useEffect(() => {
    if (!shareToken) return
    const poll = async () => {
      try {
        const { index } = await getPublicCurrentSong(shareToken)
        setConductorIdx(index)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [shareToken])

  async function conductGo(idx) {
    if (!shareToken || idx < 0 || idx >= localSongs.length) return
    setConductorIdx(idx)
    try { await setCurrentSong(setlist._id, idx) } catch { /* 다음 폴링 때 다시 맞춰진다 */ }
  }

  async function changeDate(value) {
    try { await onUpdateSetlist(setlist._id, { gigDate: value || null }) } catch (err) { setError(err.message) }
  }

  async function handleDuplicate() {
    // 다음 예배일: 원래 콘티 날짜 + 7일, 날짜가 없으면 다가오는 주일
    const base = isoToDateInput(setlist.gigDate)
    const gigDate = base ? addDays(base, 7) : nextSunday()
    const name = window.prompt('복제한 콘티의 이름', `${setlist.name} (복사)`)
    if (name === null) return
    try { await onDuplicate(setlist._id, { name, gigDate }) } catch (err) { setError(err.message) }
  }

  function openSettings(song) {
    const own = settingsMap.get(song._id)
    setSettingsSong(song)
    setSettingsForm({ key: own?.key || '', notes: own?.notes || '' })
  }

  async function saveSettings(reset = false) {
    try {
      await onSongSettings(setlist._id, settingsSong._id, reset ? { key: '', notes: '' } : settingsForm)
      setSettingsSong(null)
    } catch (err) { setError(err.message) }
  }

  async function savePin(clear = false) {
    setPinMsg('')
    try {
      const res = await onSharePin(setlist._id, clear ? '' : pinInput)
      setPinInput('')
      setPinMsg(res.hasSharePin ? '공유 비밀번호를 걸었습니다. 링크와 비밀번호를 함께 알려 주세요.' : '공유 비밀번호를 해제했습니다.')
    } catch (err) { setPinMsg(err.message) }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copySummary() {
    if (!setlist) return
    const heading = [setlist.gigDate && formatKoreanDate(setlist.gigDate), setlist.name].filter(Boolean).join(' ')
    const lines = [`📋 ${heading}`, '']
    displaySongs.forEach((s, i) => {
      let line = `${i + 1}. ${s.title}`
      if (s.artist) line += ` (${s.artist})`
      if (s.displayKey) line += ` | Key ${s.displayKey}`
      if (s.bpm > 0) line += ` | BPM ${s.bpm}`
      if (s.structure) line += `\n   ${s.structure}`
      if (s.displayNotes) line += `\n   📝 ${s.displayNotes}`
      lines.push(line)
    })
    if (shareLink) { lines.push(''); lines.push(`🔗 ${shareLink}`) }
    navigator.clipboard.writeText(lines.join('\n'))
    setSummaryCopied(true)
    setTimeout(() => setSummaryCopied(false), 2000)
  }

  if (!setlist) {
    return (
      <div className="card panel">
        <h2>콘티 상세</h2>
        <p className="muted">콘티를 선택하세요</p>
      </div>
    )
  }

  return (
    <div className="card panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{setlist.name}</h2>
          <label className="date-inline">
            예배 날짜
            <input
              type="date"
              value={isoToDateInput(setlist.gigDate)}
              onChange={(e) => changeDate(e.target.value)}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {localSongs.some(s => s.youtubeUrl) && (
            <button
              type="button"
              style={{ fontSize: 13, background: showPlayer ? '#0f172a' : '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setShowPlayer(v => !v); setPlayerIdx(0) }}
            >
              {showPlayer ? '■ 재생 닫기' : '▶ 연속재생'}
            </button>
          )}
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={copySummary}>
            {summaryCopied ? '복사됨!' : '💬 카톡 요약'}
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleShare}>
            🔗 공유 링크
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={() => setShowPrint(true)} disabled={!localSongs.length}>
            🖨 인쇄·PDF
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleDuplicate}>
            📄 복제
          </button>
        </div>
      </div>

      {/* 연속재생 패널 */}
      {showPlayer && localSongs.length > 0 && (() => {
        const ps = localSongs[playerIdx]
        const vid = getYoutubeId(ps?.youtubeUrl)
        return (
          <div style={{ background: '#0f172a', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{playerIdx + 1}/{localSongs.length}</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{ps?.title}</span>
              {ps?.key && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', color: '#86efac', padding: '2px 6px', borderRadius: 6 }}>Key {ps.key}{ps.capo > 0 ? ` · 카포 ${ps.capo}` : ''}</span>}
              {ps?.bpm > 0 && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', color: '#fbbf24', padding: '2px 6px', borderRadius: 6 }}>{ps.bpm} BPM</span>}
            </div>
            {vid ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 8, overflow: 'hidden' }}>
                <iframe
                  key={vid}
                  src={`https://www.youtube.com/embed/${vid}?autoplay=1`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '20px 0', fontSize: 13 }}>
                이 곡에는 YouTube 링크가 없습니다
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setPlayerIdx(i => Math.max(0, i - 1))}
                disabled={playerIdx === 0}
                style={{ background: 'rgba(255,255,255,0.1)', color: playerIdx === 0 ? '#475569' : '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
              >‹ 이전</button>
              <button
                onClick={() => setPlayerIdx(i => Math.min(localSongs.length - 1, i + 1))}
                disabled={playerIdx === localSongs.length - 1}
                style={{ background: 'rgba(255,255,255,0.2)', color: playerIdx === localSongs.length - 1 ? '#475569' : '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
              >다음 ›</button>
            </div>
          </div>
        )
      })()}

      {shareLink && (
        <>
          {/* 링크 표시줄 */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="share-link-text" style={{ fontSize: 12, flex: 1, wordBreak: 'break-all', color: '#166534' }}>{shareLink}</span>
            <button type="button" className="secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={copyLink}>
              {copied ? '복사됨!' : '복사'}
            </button>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 10px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => window.open(shareLink, '_blank')}
            >
              🔗 미리보기
            </button>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { navigator.clipboard.writeText(`${shareLink}?view=sheet`) }}
              title="악보 슬라이드 모드로 바로 열리는 링크 복사"
            >
              📄 악보링크
            </button>
          </div>

          {/* 공유 비밀번호 (선택) */}
          <div className="share-pin">
            <span>
              🔒 공유 비밀번호 {setlist.hasSharePin ? <b>걸려 있음</b> : <span className="muted-dark">없음 (링크만 있으면 누구나 볼 수 있음)</span>}
            </span>
            <span className="share-pin-form">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="숫자 6~8자리"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              />
              <button type="button" className="secondary" onClick={() => savePin(false)} disabled={pinInput.length < 6}>
                {setlist.hasSharePin ? '바꾸기' : '걸기'}
              </button>
              {setlist.hasSharePin && (
                <button type="button" className="secondary" onClick={() => savePin(true)}>해제</button>
              )}
            </span>
            {pinMsg && <span className="share-pin-msg">{pinMsg}</span>}
          </div>

          {/* 진행 컨트롤러 */}
          {localSongs.length > 0 && (
            <div style={{ background: '#14532d', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => conductGo(conductorIdx - 1)}
                disabled={conductorIdx === 0}
                style={{ width: 44, height: 44, border: 'none', borderRadius: 8, background: conductorIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 22, cursor: conductorIdx === 0 ? 'default' : 'pointer', flexShrink: 0 }}
              >‹</button>

              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 2 }}>
                  🔴 실시간 진행 중 · {conductorIdx + 1} / {localSongs.length}곡
                </div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {localSongs[conductorIdx]?.title || '—'}
                </div>
                {displaySongs[conductorIdx]?.displayKey && (
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                    Key {displaySongs[conductorIdx].displayKey}
                    {localSongs[conductorIdx].bpm > 0 && ` · ${localSongs[conductorIdx].bpm} BPM`}
                  </div>
                )}
              </div>

              <button
                onClick={() => conductGo(conductorIdx + 1)}
                disabled={conductorIdx === localSongs.length - 1}
                style={{ width: 44, height: 44, border: 'none', borderRadius: 8, background: conductorIdx === localSongs.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 22, cursor: conductorIdx === localSongs.length - 1 ? 'default' : 'pointer', flexShrink: 0 }}
              >›</button>
            </div>
          )}
        </>
      )}

      <div className="section-block">
        <h3>콘티 순서 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(드래그로 순서 변경)</span></h3>

        {/* 연습 진행도 */}
        {localSongs.length > 0 && (
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            연습 완료 {localSongs.filter(s => practiced[s._id]).length} / {localSongs.length}곡
            {localSongs.filter(s => practiced[s._id]).length === localSongs.length && localSongs.length > 0 && (
              <span style={{ marginLeft: 6, color: '#15803d', fontWeight: 700 }}>🎉 전곡 완료!</span>
            )}
          </div>
        )}

        {localSongs.length ? (
          <ul className="item-list">
            {displaySongs.map((song, idx) => (
              <li
                key={song._id}
                className="item-row"
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                style={{ cursor: 'grab', userSelect: 'none', opacity: practiced[song._id] ? 0.6 : 1 }}
              >
                <div className="setlist-song-inner" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* 연습완료 체크박스 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePracticed(song._id) }}
                    style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 6,
                      border: `2px solid ${practiced[song._id] ? '#15803d' : '#cbd5e1'}`,
                      background: practiced[song._id] ? '#15803d' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: '#fff', lineHeight: 1,
                    }}
                    title="연습 완료 표시"
                  >
                    {practiced[song._id] ? '✓' : ''}
                  </button>

                  {/* 드래그 핸들 */}
                  <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>⠿</span>

                  {/* 악보 썸네일 */}
                  {song.sheetImageUrl && (
                    <img
                      src={song.sheetImageUrl}
                      alt=""
                      style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', flexShrink: 0 }}
                    />
                  )}

                  {/* 곡 정보 */}
                  <div className="setlist-song-info" style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <span className="song-order">{idx + 1}.</span>
                      <strong>{song.title}</strong>
                      {song.artist && <span className="muted"> — {song.artist}</span>}
                    </div>
                    <div className="badge-row">
                      {song.displayKey && (
                        <span className="badge badge-key" title={song.keyOverridden ? `이 콘티에서만 ${song.displayKey} (원래 ${song.key || '없음'})` : undefined}>
                          {song.displayKey}{song.keyOverridden && ` ← ${song.key || '-'}`}
                        </span>
                      )}
                      {song.capo > 0 && <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>카포 {song.capo}</span>}
                      {song.bpm > 0 && <span className="badge badge-bpm">{song.bpm} BPM</span>}
                    </div>
                    {song.structure && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {song.structure}
                      </div>
                    )}
                    {song.displayNotes && <div className="setlist-song-note">📝 {song.displayNotes}</div>}
                  </div>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openSettings(song)}
                    style={{ flexShrink: 0, fontSize: 12 }}
                    title="이 콘티에서만 쓸 Key·메모"
                  >
                    Key·메모
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleRemoveSong(song._id)}
                    disabled={submitting}
                    style={{ cursor: 'pointer', flexShrink: 0, fontSize: 12 }}
                  >
                    제거
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">콘티에 곡이 없습니다</p>
        )}

        {settingsSong && (
          <div className="song-settings">
            <b>‘{settingsSong.title}’ — 이 콘티에서만</b>
            <span className="muted-dark">곡 목록의 원래 정보(Key {settingsSong.key || '없음'})는 바뀌지 않습니다.</span>
            <label>
              Key
              <select value={settingsForm.key} onChange={(e) => setSettingsForm((f) => ({ ...f, key: e.target.value }))}>
                <option value="">원래 Key 그대로 ({settingsSong.key || '없음'})</option>
                {KEY_ORDER.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label>
              메모
              <textarea
                rows={2}
                placeholder="예: 2절 후 간주 길게, 마지막 후렴 반복"
                value={settingsForm.notes}
                onChange={(e) => setSettingsForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <span className="song-settings-actions">
              <button type="button" onClick={() => saveSettings(false)}>저장</button>
              <button type="button" className="secondary" onClick={() => saveSettings(true)}>원래대로</button>
              <button type="button" className="secondary" onClick={() => setSettingsSong(null)}>취소</button>
            </span>
          </div>
        )}
      </div>

      <div className="section-block">
        <h3>곡 추가</h3>

        {availableSongs.length === 0 ? (
          <p className="muted">추가할 수 있는 곡이 없습니다</p>
        ) : (
          <>
            <div className="picker-toolbar">
              <input
                type="search"
                placeholder="제목·아티스트·코드 검색"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              <button
                type="button"
                className={pickerFavOnly ? 'fav-filter on' : 'fav-filter'}
                aria-pressed={pickerFavOnly}
                onClick={() => setPickerFavOnly((v) => !v)}
              >
                ★ 즐겨찾기만
              </button>
              <select value={pickerSort} onChange={(e) => setPickerSort(e.target.value)} aria-label="정렬">
                {PICKER_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="view-toggle" role="group" aria-label="보기 방식">
                <button
                  type="button"
                  className={pickerView === 'list' ? 'active' : ''}
                  aria-pressed={pickerView === 'list'}
                  onClick={() => changePickerView('list')}
                >
                  목록
                </button>
                <button
                  type="button"
                  className={pickerView === 'card' ? 'active' : ''}
                  aria-pressed={pickerView === 'card'}
                  onClick={() => changePickerView('card')}
                >
                  카드
                </button>
              </div>
            </div>

            {pickerSort === 'key' && pickerKeyCounts.length > 0 && (
              <div className="key-chips" role="group" aria-label="코드 선택">
                <button
                  type="button"
                  className={pickerKey === '' ? 'active' : ''}
                  aria-pressed={pickerKey === ''}
                  onClick={() => setPickerKey('')}
                >
                  전체
                </button>
                {pickerKeyCounts.map(([key, count]) => (
                  <button
                    key={key}
                    type="button"
                    className={pickerKey === key ? 'active' : ''}
                    aria-pressed={pickerKey === key}
                    onClick={() => setPickerKey(pickerKey === key ? '' : key)}
                  >
                    {key === 'none' ? '코드 없음' : key} <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
            )}

            {pickerSongs.length === 0 ? (
              <p className="muted">
                {pickerSearch ? `"${pickerSearch}" 검색 결과가 없습니다`
                  : pickerFavOnly ? '즐겨찾기한 곡이 없습니다'
                  : '이 코드의 곡이 없습니다'}
              </p>
            ) : (
              <div className={`song-picker song-picker-${pickerView}`}>
                {pickerSongs.map((song) => {
                  const checked = selectedSongIds.includes(song._id)
                  return (
                    <label key={song._id} className={checked ? 'picker-item selected' : 'picker-item'}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSong(song._id)} />
                      {pickerView === 'card' ? (
                        <span className="picker-card-body">
                          <span className="song-title-row">
                            <FavoriteStar song={song} onToggle={onToggleFavorite} />
                            <strong>{song.title}</strong>
                          </span>
                          {song.artist && <span className="muted">{song.artist}</span>}
                          <span className="badge-row">
                            {song.key && <span className="badge badge-key">{song.key}</span>}
                            {song.bpm > 0 && <span className="badge badge-bpm">{song.bpm} BPM</span>}
                          </span>
                        </span>
                      ) : (
                        <span className="picker-list-body">
                          <FavoriteStar song={song} onToggle={onToggleFavorite} />
                          {song.key && <span className="badge badge-key">{song.key}</span>}
                          <span className="picker-title">{song.title}</span>
                          {song.artist && <span className="muted picker-artist">{song.artist}</span>}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            <button
              onClick={handleAddSongs}
              disabled={submitting || selectedSongIds.length === 0}
            >
              {submitting ? '처리 중...' : `선택한 곡 추가${selectedSongIds.length ? ` (${selectedSongIds.length})` : ''}`}
            </button>
          </>
        )}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      {showPrint && <PrintView setlist={setlist} songs={displaySongs} onClose={() => setShowPrint(false)} />}
    </div>
  )
}
