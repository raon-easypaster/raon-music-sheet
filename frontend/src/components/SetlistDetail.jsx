import { useEffect, useMemo, useState, useRef } from 'react'
import { getPublicCurrentSong, setCurrentSong } from '../api/setlists'
import { sortSongs, filterSongs, countByKey, filterByKey, KEY_ORDER } from '../utils/songSort'
import FavoriteStar from './FavoriteStar'
import PrintView from './PrintView'
import SongFilterBar from './SongFilterBar'
import AssignmentPanel from './AssignmentPanel'
import Icon from './Icon'
import { precacheSheets } from '../utils/offline'
import { formatKoreanDate, isoToDateInput, addDays, nextSunday } from '../utils/dates'
import { usageStats, usageText, applyMetaFilters, checkSetlist, EMPTY_FILTERS } from '../utils/songMeta'
import { ITEM_KINDS, KIND_LABEL, SERVICE_TYPES, buildRows, toPayload, timeline, formatMinutes } from '../utils/serviceOrder'

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
  setlists = [],
  onUpdateItems,
  onSaveTemplate,
  onAddSongs,
  onToggleFavorite,
  onRemoveSong,
  onReorder,
  onShare,
  onUpdateSetlist,
  onDuplicate,
  onSongSettings,
  onSharePin,
  team = null,
  currentUserId,
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
  const [pickerFilters, setPickerFilters] = useState(EMPTY_FILTERS)
  const [pickerFilterOpen, setPickerFilterOpen] = useState(false)
  const [newItem,       setNewItem]       = useState(null)   // 순서 항목 추가 중 { kind, title, minutes }
  const [editingRow,    setEditingRow]    = useState(null)   // 고치는 중인 순서 항목 key
  const [rowForm,       setRowForm]       = useState({ title: '', minutes: '', note: '' })
  const [templateMsg,   setTemplateMsg]   = useState('')
  const [offlineMsg,    setOfflineMsg]    = useState('')

  // drag state
  const dragIndex = useRef(null)
  const [localSongs, setLocalSongs] = useState([])
  const [localRows, setLocalRows] = useState([])

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
    setNewItem(null)
    setEditingRow(null)
    setTemplateMsg('')
    setOfflineMsg('')
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

  const songsById = useMemo(() => new Map(displaySongs.map((s) => [s._id, s])), [displaySongs])

  // 예배 순서 (곡 + 기도·말씀·광고 …). 저장 후 다시 불러오면 새 순서로 바꾼다
  useEffect(() => { setLocalRows(buildRows(setlist, songsById)) }, [setlist, songsById])
  const hasItems = (setlist?.items || []).length > 0
  const times = useMemo(() => timeline(localRows, setlist?.startTime, songsById), [localRows, setlist?.startTime, songsById])

  // 부른 기록: 이 콘티는 빼고 센다 (자동 점검의 '처음 부르는 곡' 판단용)
  const usageOthers = useMemo(() => usageStats(setlists.filter((s) => s._id !== setlist?._id)), [setlists, setlist?._id])
  const usageAll = useMemo(() => usageStats(setlists), [setlists])
  const warnings = useMemo(
    () => checkSetlist(displaySongs.map((s) => ({ ...s, key: s.displayKey })), usageOthers),
    [displaySongs, usageOthers]
  )

  const availableSongs = useMemo(() => {
    return songs.filter((song) => !existingSongIds.includes(song._id))
  }, [songs, existingSongIds])

  // 코드순일 때 위에 나열할 코드: 실제로 곡이 있는 코드만, 곡 수와 함께
  // 검색어·즐겨찾기 조건을 먼저 적용한 목록 (코드 버튼의 곡 수도 이 기준)
  const pickerBase = useMemo(() => {
    const searched = applyMetaFilters(filterSongs(availableSongs, pickerSearch), pickerFilters, usageAll)
    return pickerFavOnly ? searched.filter((s) => s.isFavorite) : searched
  }, [availableSongs, pickerSearch, pickerFavOnly, pickerFilters, usageAll])

  const pickerKeyCounts = useMemo(() => countByKey(pickerBase), [pickerBase])

  const pickerSongs = useMemo(() => {
    const list = pickerSort === 'key' ? filterByKey(pickerBase, pickerKey) : pickerBase
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
    const updated = [...localRows]
    const [moved] = updated.splice(dragIndex.current, 1)
    updated.splice(idx, 0, moved)
    dragIndex.current = idx
    setLocalRows(updated)
  }

  // 순서 저장: 순서 항목이 있으면 전체 순서를, 곡만 있으면 곡 순서만 저장한다
  async function saveRows(rows) {
    setLocalRows(rows)
    try {
      if (hasItems || rows.some((r) => r.kind !== 'song')) await onUpdateItems(setlist._id, toPayload(rows))
      else await onReorder(setlist._id, rows.map((r) => r.song))
    } catch (err) {
      setError(err.message || '순서를 저장하지 못했습니다')
      setLocalRows(buildRows(setlist, songsById))
    }
  }

  async function handleDrop() {
    if (!setlist || dragIndex.current === null) return
    dragIndex.current = null
    await saveRows(localRows)
  }

  // 휴대폰에서는 끌기가 어려우므로 ▲▼ 버튼으로도 옮긴다
  function moveRow(idx, dir) {
    const to = idx + dir
    if (to < 0 || to >= localRows.length) return
    const rows = [...localRows]
    ;[rows[idx], rows[to]] = [rows[to], rows[idx]]
    saveRows(rows)
  }

  function addItem() {
    if (!newItem) return
    const kind = ITEM_KINDS.find((k) => k.value === newItem.kind)
    const row = { key: `new${Date.now()}`, kind: newItem.kind, song: null, title: newItem.title.trim(), minutes: Number(newItem.minutes) || kind?.minutes || 0, note: '' }
    saveRows([...localRows, row])
    setNewItem(null)
  }

  function openRowEdit(row) {
    setEditingRow(row.key)
    setRowForm({ title: row.title || '', minutes: row.minutes || '', note: row.note || '' })
  }

  function saveRowEdit() {
    saveRows(localRows.map((r) => (r.key === editingRow
      ? { ...r, title: r.kind === 'song' ? '' : rowForm.title.trim(), minutes: Number(rowForm.minutes) || 0, note: rowForm.note.trim() }
      : r)))
    setEditingRow(null)
  }

  function removeRow(row) {
    if (row.kind === 'song') return handleRemoveSong(row.song)
    saveRows(localRows.filter((r) => r.key !== row.key))
  }

  async function changeServiceType(value) {
    const v = value.trim()
    if (v === (setlist.serviceType || '')) return
    try { await onUpdateSetlist(setlist._id, { serviceType: v }) } catch (err) { setError(err.message) }
  }

  async function changeStartTime(value) {
    try { await onUpdateSetlist(setlist._id, { startTime: value }) } catch (err) { setError(err.message) }
  }

  // 예배당 인터넷이 약할 때를 위해 이 콘티 악보 사진을 이 기기에 저장해 둔다
  async function saveOffline() {
    const urls = localSongs.map((s) => s.sheetImageUrl).filter(Boolean)
    if (!urls.length) return setOfflineMsg('이 콘티에는 저장할 악보 사진이 없습니다.')
    setOfflineMsg('악보를 저장하는 중…')
    const r = await precacheSheets(urls)
    if (!r.supported) return setOfflineMsg('이 브라우저에서는 오프라인 저장을 쓸 수 없습니다. 앱으로 설치하거나 크롬·사파리 최신 버전을 써 주세요.')
    setOfflineMsg(r.failed
      ? `악보 ${r.saved + r.skipped}장 저장, ${r.failed}장은 저장하지 못했습니다. 인터넷이 될 때 다시 눌러 주세요.`
      : `악보 ${r.saved + r.skipped}장을 이 기기에 저장했습니다. 인터넷이 끊겨도 공유 화면에서 볼 수 있어요.`)
  }

  async function handleSaveTemplate() {
    const name = window.prompt('템플릿 이름 (곡은 빼고 순서만 저장합니다)', setlist.serviceType || setlist.name)
    if (!name?.trim()) return
    setTemplateMsg('')
    try {
      await onSaveTemplate(setlist._id, name.trim())
      setTemplateMsg(`'${name.trim()}' 템플릿을 저장했습니다. 콘티 만들기에서 고를 수 있어요.`)
    } catch (err) { setError(err.message) }
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
    const lines = [`📋 ${heading}`]
    if (setlist.serviceType || setlist.startTime) {
      lines.push([setlist.serviceType, setlist.startTime && `${setlist.startTime} 시작 (총 ${formatMinutes(times.total)})`].filter(Boolean).join(' · '))
    }
    lines.push('')
    if (hasItems) {
      // 예배 순서가 있으면 찬양 외 순서도 함께
      let n = 0
      localRows.forEach((row, i) => {
        const at = times.list[i]?.at ? `${times.list[i].at} ` : ''
        if (row.kind !== 'song') {
          lines.push(`${at}[${KIND_LABEL[row.kind]}]${row.title ? ` ${row.title}` : ''}${row.note ? ` — ${row.note}` : ''}`)
          return
        }
        const s = songsById.get(row.song)
        n += 1
        let line = `${at}${n}. ${s.title}`
        if (s.displayKey) line += ` | Key ${s.displayKey}`
        if (s.displayNotes) line += `\n   📝 ${s.displayNotes}`
        lines.push(line)
      })
    } else displaySongs.forEach((s, i) => {
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
          <label className="date-inline">
            시작
            <input type="time" value={setlist.startTime || ''} onChange={(e) => changeStartTime(e.target.value)} />
          </label>
          <label className="date-inline">
            예배 종류
            <input
              key={setlist._id + (setlist.serviceType || '')}
              type="text"
              list="detail-service-types"
              placeholder="예: 주일 1부"
              maxLength={30}
              defaultValue={setlist.serviceType || ''}
              onBlur={(e) => changeServiceType(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="type-input"
            />
          </label>
          <datalist id="detail-service-types">
            {SERVICE_TYPES.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {localSongs.some(s => s.youtubeUrl) && (
            <button
              type="button"
              style={{ fontSize: 13 }}
              onClick={() => { setShowPlayer(v => !v); setPlayerIdx(0) }}
            >
              <Icon name={showPlayer ? 'stop' : 'play'} />{showPlayer ? '재생 닫기' : '연속재생'}
            </button>
          )}
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={copySummary}>
            <Icon name="message" />{summaryCopied ? '복사됨!' : '카톡 요약'}
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleShare}>
            <Icon name="link" />공유 링크
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={() => setShowPrint(true)} disabled={!localSongs.length}>
            <Icon name="printer" />인쇄·PDF
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleDuplicate}>
            <Icon name="copy" />복제
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={saveOffline} disabled={!localSongs.length}
            title="예배당 인터넷이 약할 때를 위해 악보 사진을 이 기기에 저장">
            <Icon name="download" />악보 오프라인 저장
          </button>
          {onSaveTemplate && (
            <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleSaveTemplate} disabled={!localRows.length}
              title="이 콘티의 예배 순서를 템플릿으로 저장 (곡은 '찬양 자리'로 남김)">
              <Icon name="template" />템플릿으로 저장
            </button>
          )}
        </div>
      </div>
      {templateMsg && <p className="ok-text">{templateMsg}</p>}
      {offlineMsg && <p className="ok-text">{offlineMsg}</p>}

      {warnings.length > 0 && (
        <div className="check-box" role="status">
          <b>콘티 점검</b>
          <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <span className="muted-dark">참고용 안내입니다. 그대로 저장해도 괜찮아요.</span>
        </div>
      )}

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
              className="secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => window.open(shareLink, '_blank')}
            >
              미리보기
            </button>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 10px', background: 'var(--gold)' }}
              onClick={() => { navigator.clipboard.writeText(`${shareLink}?view=sheet`) }}
              title="악보 슬라이드 모드로 바로 열리는 링크 복사"
            >
              <Icon name="file" />악보링크
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
        <h3>
          예배 순서 <span className="hint">(끌거나 ▲▼로 순서 변경)</span>
        </h3>
        {localRows.length > 0 && (
          <div className="time-summary">
            총 <b>{formatMinutes(times.total)}</b>
            {setlist.startTime
              ? <> · {setlist.startTime} 시작 → <b>{times.end}</b> 끝</>
              : <span className="muted"> · 시작 시각을 넣으면 순서별 시각이 나와요</span>}
          </div>
        )}

        {/* 연습 진행도 */}
        {localSongs.length > 0 && (
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            연습 완료 {localSongs.filter(s => practiced[s._id]).length} / {localSongs.length}곡
            {localSongs.filter(s => practiced[s._id]).length === localSongs.length && localSongs.length > 0 && (
              <span style={{ marginLeft: 6, color: '#15803d', fontWeight: 700 }}>🎉 전곡 완료!</span>
            )}
          </div>
        )}

        {localRows.length ? (
          <ul className="item-list order-list">
            {localRows.map((row, idx) => {
              const song = row.kind === 'song' ? songsById.get(row.song) : null
              const songNo = localRows.slice(0, idx + 1).filter((r) => r.kind === 'song').length
              const t = times.list[idx]
              return (
              <li
                key={row.key}
                className={`item-row order-row kind-${row.kind}`}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                style={{ cursor: 'grab', userSelect: 'none', opacity: song && practiced[song._id] ? 0.6 : 1 }}
              >
                <div className="setlist-song-inner" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="order-time" title={`${t?.minutes || 0}분`}>
                    {t?.at && <b>{t.at}</b>}
                    <span>{t?.minutes || 0}분</span>
                  </span>

                  {song ? (
                    <>
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
                          <span className="song-order">{songNo}.</span>
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
                          {!usageOthers.get(song._id) && <span className="badge badge-new">처음 부르는 곡</span>}
                        </div>
                        {song.structure && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {song.structure}
                          </div>
                        )}
                        {song.displayNotes && <div className="setlist-song-note">📝 {song.displayNotes}</div>}
                        {row.note && <div className="setlist-song-note">🗒 {row.note}</div>}
                      </div>
                    </>
                  ) : (
                    <div className="setlist-song-info order-item-info" style={{ flex: 1, minWidth: 0 }}>
                      <span className={`kind-tag kind-tag-${row.kind}`}>{KIND_LABEL[row.kind]}</span>
                      <strong>{row.title || (row.kind === 'slot' ? '곡을 추가하면 이 자리에 들어갑니다' : '')}</strong>
                      {row.note && <div className="setlist-song-note">🗒 {row.note}</div>}
                    </div>
                  )}

                  <span className="row-move">
                    <button type="button" className="secondary" onClick={() => moveRow(idx, -1)} disabled={idx === 0} aria-label="위로">▲</button>
                    <button type="button" className="secondary" onClick={() => moveRow(idx, 1)} disabled={idx === localRows.length - 1} aria-label="아래로">▼</button>
                  </span>

                  <span className="row-actions">
                    {song && (
                      <button type="button" className="secondary" onClick={() => openSettings(song)} title="이 콘티에서만 쓸 Key·메모">
                        Key·메모
                      </button>
                    )}
                    <button type="button" className="secondary" onClick={() => openRowEdit(row)} title="시간·이름·메모">
                      {song ? '시간' : '수정'}
                    </button>
                    <button type="button" className="secondary" onClick={() => removeRow(row)} disabled={submitting}>
                      {song ? '제거' : '삭제'}
                    </button>
                  </span>
                </div>

                {editingRow === row.key && (
                  <div className="row-edit" onClick={(e) => e.stopPropagation()}>
                    {!song && (
                      <input type="text" placeholder="이름 (예: 대표기도, 설교 제목)" maxLength={60}
                        value={rowForm.title} onChange={(e) => setRowForm((f) => ({ ...f, title: e.target.value }))} />
                    )}
                    <label>
                      시간(분)
                      <input type="number" min="0" max="180" placeholder={String(t?.minutes || 0)}
                        value={rowForm.minutes} onChange={(e) => setRowForm((f) => ({ ...f, minutes: e.target.value }))} />
                    </label>
                    <input type="text" placeholder="메모 (예: 담당자, 준비물)" maxLength={300}
                      value={rowForm.note} onChange={(e) => setRowForm((f) => ({ ...f, note: e.target.value }))} />
                    <span className="song-settings-actions">
                      <button type="button" onClick={saveRowEdit}>저장</button>
                      <button type="button" className="secondary" onClick={() => setEditingRow(null)}>취소</button>
                    </span>
                  </div>
                )}
              </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted">콘티에 곡이 없습니다</p>
        )}

        {onUpdateItems && (newItem ? (
          <div className="row-edit add-item">
            <select value={newItem.kind} onChange={(e) => setNewItem((n) => ({ ...n, kind: e.target.value, minutes: '' }))} aria-label="항목 종류">
              {ITEM_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input type="text" placeholder="이름 (선택, 예: 대표기도 김OO)" maxLength={60}
              value={newItem.title} onChange={(e) => setNewItem((n) => ({ ...n, title: e.target.value }))} />
            <input type="number" min="0" max="180" aria-label="시간(분)"
              placeholder={`${ITEM_KINDS.find((k) => k.value === newItem.kind)?.minutes || 0}분`}
              value={newItem.minutes} onChange={(e) => setNewItem((n) => ({ ...n, minutes: e.target.value }))} />
            <span className="song-settings-actions">
              <button type="button" onClick={addItem}>맨 뒤에 추가</button>
              <button type="button" className="secondary" onClick={() => setNewItem(null)}>취소</button>
            </span>
          </div>
        ) : (
          <button type="button" className="secondary add-item-btn" onClick={() => setNewItem({ kind: 'prayer', title: '', minutes: '' })}>
            + 기도·말씀·광고 등 순서 추가
          </button>
        ))}

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

      {team && (
        <div className="section-block">
          <h3>팀원 배정</h3>
          <AssignmentPanel setlist={setlist} team={team} members={team.members} currentUserId={currentUserId} />
        </div>
      )}

      <div className="section-block">
        <h3>곡 추가</h3>

        {availableSongs.length === 0 ? (
          <p className="muted">추가할 수 있는 곡이 없습니다</p>
        ) : (
          <>
            <div className="picker-toolbar">
              <input
                type="search"
                placeholder="제목·아티스트·코드·태그 검색"
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

            <SongFilterBar filters={pickerFilters} onChange={setPickerFilters} open={pickerFilterOpen}
              onToggle={() => setPickerFilterOpen((v) => !v)} songs={availableSongs} />

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
                {Object.values(pickerFilters).some(Boolean) ? '상세 검색 조건에 맞는 곡이 없습니다'
                  : pickerSearch ? `"${pickerSearch}" 검색 결과가 없습니다`
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
                          <span className="muted usage-line">{usageText(usageAll.get(song._id))}</span>
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

      {showPrint && (
        <PrintView
          setlist={setlist}
          songs={displaySongs}
          order={hasItems ? localRows.map((row, i) => ({ ...row, at: times.list[i]?.at, minutes: times.list[i]?.minutes, songData: songsById.get(row.song) })) : null}
          totalMinutes={times.total}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
