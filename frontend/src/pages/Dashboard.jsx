import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/useAuth'
import { getSongs, createSong, deleteSong, updateSong } from '../api/songs'
import {
  getSetlists,
  createSetlist,
  addSongsToSetlist,
  removeSongFromSetlist,
  deleteSetlist,
  reorderSetlist,
  generateShareToken,
} from '../api/setlists'
import { changePasswordRequest } from '../api/auth'
import SongForm from '../components/SongForm'
import SetlistForm from '../components/SetlistForm'
import SongList from '../components/SongList'
import SetlistList from '../components/SetlistList'
import SetlistDetail from '../components/SetlistDetail'
import TeamPanel from '../components/TeamPanel'
import HelpPage from '../components/HelpPage'
import PracticeTools from '../components/PracticeTools'

const TABS = ['곡 목록', '콘티', '팀', '연습 도구', '사용법']

export default function Dashboard() {
  const { logout } = useAuth()

  const [songs, setSongs] = useState([])
  const [setlists, setSetlists] = useState([])
  const [selectedSetlistId, setSelectedSetlistId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [songsData, setlistsData] = await Promise.all([getSongs(), getSetlists()])
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
      setError(err.message || '데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [selectedSetlistId])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreateSong(payload) { await createSong(payload); await loadData() }
  async function handleCreateSetlist(payload) { await createSetlist(payload); await loadData() }
  async function handleAddSongs(setlistId, songIds) { await addSongsToSetlist(setlistId, songIds); await loadData() }
  async function handleRemoveSong(setlistId, songId) { await removeSongFromSetlist(setlistId, songId); await loadData() }
  async function handleDeleteSetlist(setlistId) { await deleteSetlist(setlistId); await loadData() }
  async function handleDeleteSong(songId) { await deleteSong(songId); await loadData() }
  async function handleUpdateSong(id, payload) { await updateSong(id, payload); await loadData() }
  async function handleReorder(setlistId, songIds) { await reorderSetlist(setlistId, songIds); await loadData() }
  async function handleShare(setlistId) { return generateShareToken(setlistId) }

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
      setTimeout(() => setShowPwModal(false), 1500)
    } catch (err) {
      setPwMsg(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  const selectedSetlist = setlists.find((s) => s._id === selectedSetlistId) || null

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">찬양팀 악보 & 콘티 관리</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary" onClick={() => { setShowPwModal(true); setPwMsg('') }}>비밀번호 변경</button>
          <button className="secondary" onClick={logout}>로그아웃</button>
        </div>
      </header>

      {showPwModal && (
        <div className="modal-overlay" onClick={() => setShowPwModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>비밀번호 변경</h2>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="password"
                placeholder="현재 비밀번호"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
              <input
                type="password"
                placeholder="새 비밀번호 (6자 이상)"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                required
              />
              <input
                type="password"
                placeholder="새 비밀번호 확인"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
              {pwMsg && <p style={{ color: pwMsg.includes('변경되었') ? 'green' : 'red', margin: 0 }}>{pwMsg}</p>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setShowPwModal(false)}>취소</button>
                <button type="submit" disabled={pwLoading}>{pwLoading ? '변경 중...' : '변경'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error ? <div className="card error-banner">{error}</div> : null}

      <nav className="tab-nav">
        {TABS.map((name, i) => (
          <button
            key={name}
            className={tab === i ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab(i)}
          >
            {name}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="card panel">불러오는 중...</div>
      ) : (
        <>
          {tab === 0 && (
            <>
              <SongForm onCreate={handleCreateSong} />
              <SongList songs={songs} onDelete={handleDeleteSong} onUpdate={handleUpdateSong} />
            </>
          )}

          {tab === 1 && (
            <>
              <SetlistForm onCreate={handleCreateSetlist} />
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
                  onAddSongs={handleAddSongs}
                  onRemoveSong={handleRemoveSong}
                  onReorder={handleReorder}
                  onShare={handleShare}
                />
              </div>
            </>
          )}

          {tab === 2 && <TeamPanel />}
          {tab === 3 && <PracticeTools />}
          {tab === 4 && <HelpPage />}
        </>
      )}
    </div>
  )
}
