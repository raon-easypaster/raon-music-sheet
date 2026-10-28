import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../context/useAuth'
import { getSongs, createSong, deleteSong, updateSong, setFavorite } from '../api/songs'
import {
  getSetlists,
  createSetlist,
  addSongsToSetlist,
  removeSongFromSetlist,
  deleteSetlist,
  reorderSetlist,
  generateShareToken,
  updateSetlist,
  duplicateSetlist,
  updateSongSettings,
  setSharePin,
  updateSetlistItems,
  getTemplates,
  createTemplate,
  deleteTemplate,
} from '../api/setlists'
import { changePasswordRequest } from '../api/auth'
import { getMyTeams } from '../api/teams'
import SongForm from '../components/SongForm'
import SetlistForm from '../components/SetlistForm'
import SongList from '../components/SongList'
import SetlistList from '../components/SetlistList'
import SetlistDetail from '../components/SetlistDetail'
import TeamPanel from '../components/TeamPanel'
import HelpPage from '../components/HelpPage'
import PracticeTools from '../components/PracticeTools'
import InstallAppButton from '../components/InstallAppButton'
import Icon from '../components/Icon'
import TeamNews from '../components/TeamNews'
import useTeamUnread from '../components/useTeamUnread'

const TABS = ['곡 목록', '콘티', '팀', '팀 소식', '연습 도구', '사용법']
const TAB_ICONS = ['music', 'list', 'users', 'bell', 'tool', 'help']
const TAB_COUNTED = { 0: 'songs', 1: 'setlists' } // 곡 목록·콘티 탭에는 개수를 함께 보여 준다
const WORKSPACE_KEY = 'workspace'

function loadSavedWorkspace() {
  try { return localStorage.getItem(WORKSPACE_KEY) || '' } catch { return '' }
}

export default function Dashboard() {
  const { logout, user, markPasswordChanged } = useAuth()

  // 작업 공간: '' = 내 개인 공간, 그 외 = 팀 id
  const [teams, setTeams] = useState([])
  const [workspace, setWorkspace] = useState(loadSavedWorkspace)

  const [songs, setSongs] = useState([])
  const [setlists, setSetlists] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedSetlistId, setSelectedSetlistId] = useState(null)
  const [loading, setLoading] = useState(true)
  // 처음 한 번만 "불러오는 중"으로 화면을 바꾼다. 저장 후 새로고침 때는 화면(공유 링크 등)을 그대로 둔다
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  // 팀장이 임시 비밀번호로 초기화한 계정은 로그인하자마자 비밀번호 변경 창을 띄운다
  const [showPwModal, setShowPwModal] = useState(() => !!user?.mustChangePassword)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      const data = await getMyTeams()
      const list = Array.isArray(data) ? data : []
      setTeams(list)
      // 나간 팀·삭제된 팀이 선택돼 있으면 개인 공간으로
      setWorkspace((ws) => (ws && !list.some((t) => t._id === ws) ? '' : ws))
    } catch {
      setTeams([])
    }
  }, [])

  // 임시 비밀번호로 들어온 계정은 비밀번호를 바꾸기 전까지 서버가 다른 요청을 막으므로 불러오지 않는다
  const mustChangePassword = !!user?.mustChangePassword

  useEffect(() => { if (!mustChangePassword) loadTeams() }, [loadTeams, mustChangePassword])

  useEffect(() => {
    try { localStorage.setItem(WORKSPACE_KEY, workspace) } catch { /* 저장 실패해도 동작에는 지장 없음 */ }
  }, [workspace])

  // 작업 공간을 빠르게 바꾸면 이전 요청의 응답이 늦게 도착할 수 있다 → 가장 최근 요청의 결과만 반영한다
  const latestLoad = useRef(0)

  const loadData = useCallback(async () => {
    const loadId = ++latestLoad.current
    setLoading(true)
    setError('')
    try {
      const team = workspace || undefined
      const [songsData, setlistsData, templatesData] = await Promise.all([
        getSongs(team),
        getSetlists(team),
        getTemplates(team).catch(() => []), // 템플릿을 못 불러와도 곡·콘티는 보여 준다
      ])
      if (loadId !== latestLoad.current) return
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      const songsArray = Array.isArray(songsData) ? songsData : songsData.songs || []
      const setlistsArray = Array.isArray(setlistsData) ? setlistsData : setlistsData.setlists || []

      setSongs(songsArray)
      setSetlists(setlistsArray)

      if (setlistsArray.length > 0) {
        const stillExists = setlistsArray.some((s) => s._id === selectedSetlistId)
        if (!selectedSetlistId || !stillExists) setSelectedSetlistId(setlistsArray[0]._id)
      } else {
        setSelectedSetlistId(null)
      }
    } catch (err) {
      if (loadId === latestLoad.current) setError(err.message || '데이터를 불러오지 못했습니다')
    } finally {
      if (loadId === latestLoad.current) { setLoading(false); setLoadedOnce(true) }
    }
  }, [selectedSetlistId, workspace])

  useEffect(() => { if (!mustChangePassword) loadData() }, [loadData, mustChangePassword])

  async function handleCreateSong(payload) { await createSong({ ...payload, team: workspace || null }); await loadData() }
  async function handleCreateSetlist(payload) { await createSetlist({ ...payload, team: workspace || null }); await loadData() }
  async function handleAddSongs(setlistId, songIds) { await addSongsToSetlist(setlistId, songIds); await loadData() }
  async function handleRemoveSong(setlistId, songId) { await removeSongFromSetlist(setlistId, songId); await loadData() }
  async function handleDeleteSetlist(setlistId) {
    try { await deleteSetlist(setlistId); await loadData() } catch (err) { setError(err.message) }
  }
  async function handleDeleteSong(songId) {
    try { await deleteSong(songId); await loadData() } catch (err) { setError(err.message) }
  }
  async function handleUpdateSong(id, payload) { await updateSong(id, payload); await loadData() }
  async function handleReorder(setlistId, songIds) { await reorderSetlist(setlistId, songIds); await loadData() }
  // 별을 누르면 화면에 바로 반영하고, 저장에 실패하면 되돌린다
  async function handleToggleFavorite(songId, favorite) {
    const apply = (value) => setSongs((prev) => prev.map((s) => (s._id === songId ? { ...s, isFavorite: value } : s)))
    apply(favorite)
    try {
      await setFavorite(songId, favorite)
    } catch (err) {
      apply(!favorite)
      setError(err.message)
    }
  }

  async function handleShare(setlistId) { return generateShareToken(setlistId) }
  async function handleUpdateSetlist(setlistId, payload) { await updateSetlist(setlistId, payload); await loadData() }
  async function handleUpdateItems(setlistId, items) { await updateSetlistItems(setlistId, items); await loadData() }
  async function handleSaveTemplate(setlistId, name) { await createTemplate(setlistId, name); await loadData() }
  async function handleDeleteTemplate(templateId) { await deleteTemplate(templateId); await loadData() }
  async function handleSongSettings(setlistId, songId, payload) { await updateSongSettings(setlistId, songId, payload); await loadData() }
  async function handleSharePin(setlistId, pin) { const res = await setSharePin(setlistId, pin); await loadData(); return res }
  async function handleDuplicate(setlistId, payload) {
    const copy = await duplicateSetlist(setlistId, payload)
    setSelectedSetlistId(copy._id)
    await loadData()
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwMsg('')
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg('새 비밀번호가 일치하지 않습니다')
      return
    }
    setPwLoading(true)
    try {
      const res = await changePasswordRequest({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      setPwMsg(res.message)
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      markPasswordChanged()
      setTimeout(() => setShowPwModal(false), mustChangePassword ? 0 : 1500)
    } catch (err) {
      setPwMsg(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  const selectedSetlist = setlists.find((s) => s._id === selectedSetlistId) || null
  const currentTeam = teams.find((t) => t._id === workspace) || null
  // 팀 소식 탭 배지 (안 읽은 글 + 답하지 않은 배정)
  const teamNews = useTeamUnread(mustChangePassword ? '' : currentTeam?._id, tab)

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">찬양팀 악보 & 콘티 관리</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary" onClick={() => { setShowPwModal(true); setPwMsg('') }}>비밀번호 변경</button>
          <InstallAppButton />
          <button className="secondary" onClick={logout}>로그아웃</button>
        </div>
      </header>

      {showPwModal && (
        <div className="modal-overlay" onClick={() => { if (!mustChangePassword) setShowPwModal(false) }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>비밀번호 변경</h2>
            {user?.mustChangePassword && (
              <p className="notice-text">
                팀장이 임시 비밀번호로 초기화한 계정입니다. 현재 비밀번호 칸에 받은 임시 비밀번호를 넣고,
                앞으로 쓸 새 비밀번호로 바꿔 주세요.
              </p>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="현재 비밀번호"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="새 비밀번호 (6자 이상)"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="새 비밀번호 확인"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
              {pwMsg && <p style={{ color: pwMsg.includes('변경되었') ? 'green' : 'red', margin: 0 }}>{pwMsg}</p>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {mustChangePassword
                  ? <button type="button" className="secondary" onClick={logout}>로그아웃</button>
                  : <button type="button" className="secondary" onClick={() => setShowPwModal(false)}>취소</button>}
                <button type="submit" disabled={pwLoading}>{pwLoading ? '변경 중...' : '변경'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card workspace-bar">
        <label htmlFor="workspace-select">작업 공간</label>
        <select
          id="workspace-select"
          value={workspace}
          onChange={(e) => { setWorkspace(e.target.value); setSelectedSetlistId(null) }}
        >
          <option value="">내 개인 공간</option>
          {teams.map((t) => (
            <option key={t._id} value={t._id}>팀: {t.name}</option>
          ))}
        </select>
        <span className="muted">
          {currentTeam
            ? `팀원 ${currentTeam.members?.length || 0}명이 이 곡·콘티를 함께 보고 편집합니다`
            : '나만 보는 곡·콘티입니다'}
        </span>
      </div>

      {error ? <div className="card error-banner">{error}</div> : null}

      <nav className="tab-nav">
        {TABS.map((name, i) => (
          <button
            key={name}
            className={tab === i ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab(i)}
            aria-current={tab === i ? 'page' : undefined}
          >
            <Icon name={TAB_ICONS[i]} size={18} />
            <span className="tab-label">{name}</span>
            {TAB_COUNTED[i] && !loading && (
              <span className="tab-count">{TAB_COUNTED[i] === 'songs' ? songs.length : setlists.length}</span>
            )}
            {name === '팀 소식' && teamNews.total > 0 && <span className="tab-count tab-unread">{teamNews.total}</span>}
          </button>
        ))}
      </nav>

      {loading && !loadedOnce ? (
        <div className="card panel skeleton" aria-busy="true" aria-label="불러오는 중">
          <span /><span /><span /><span />
        </div>
      ) : (
        <>
          {tab === 0 && (
            <>
              <SongForm onCreate={handleCreateSong} />
              <SongList
                songs={songs}
                setlists={setlists}
                workspaceLabel={currentTeam ? currentTeam.name : '개인'}
                showOwner={!!currentTeam}
                canDelete={!currentTeam || currentTeam.owner?._id === user?._id}
                onDelete={handleDeleteSong}
                onUpdate={handleUpdateSong}
                onToggleFavorite={handleToggleFavorite}
              />
            </>
          )}

          {tab === 1 && (
            <>
              <SetlistForm onCreate={handleCreateSetlist} templates={templates} onDeleteTemplate={handleDeleteTemplate} />
              <div className="conti-grid">
                <SetlistList
                  setlists={setlists}
                  selectedSetlistId={selectedSetlistId}
                  onSelect={(s) => setSelectedSetlistId(s._id)}
                  onDelete={handleDeleteSetlist}
                />
                <SetlistDetail
                  setlist={selectedSetlist}
                  songs={songs}
                  setlists={setlists}
                  onUpdateItems={handleUpdateItems}
                  onSaveTemplate={handleSaveTemplate}
                  onAddSongs={handleAddSongs}
                  onToggleFavorite={handleToggleFavorite}
                  onRemoveSong={handleRemoveSong}
                  onReorder={handleReorder}
                  onShare={handleShare}
                  onUpdateSetlist={handleUpdateSetlist}
                  onDuplicate={handleDuplicate}
                  onSongSettings={handleSongSettings}
                  onSharePin={handleSharePin}
                  team={currentTeam}
                  currentUserId={user?._id}
                />
              </div>
            </>
          )}

          {tab === 2 && (
            <TeamPanel
              currentUserId={user?._id}
              onTeamsChanged={loadTeams}
              onItemsMoved={(teamId) => { setWorkspace(teamId); setSelectedSetlistId(null) }}
            />
          )}
          {tab === 3 && (
            <TeamNews
              team={currentTeam}
              currentUserId={user?._id}
              pendingAssignments={teamNews.pendingAssignments}
              onChanged={teamNews.refresh}
            />
          )}
          {tab === 4 && <PracticeTools songs={songs} />}
          {tab === 5 && <HelpPage />}
        </>
      )}
    </div>
  )
}
