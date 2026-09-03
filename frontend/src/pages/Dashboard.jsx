import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/useAuth'
import { getSongs, createSong, deleteSong } from '../api/songs'
import {
  getSetlists,
  createSetlist,
  addSongsToSetlist,
  removeSongFromSetlist,
  deleteSetlist,
  reorderSetlist,
  generateShareToken,
} from '../api/setlists'
import SongForm from '../components/SongForm'
import SetlistForm from '../components/SetlistForm'
import SongList from '../components/SongList'
import SetlistList from '../components/SetlistList'
import SetlistDetail from '../components/SetlistDetail'
import TeamPanel from '../components/TeamPanel'

const TABS = ['곡 목록', '콘티', '팀']

export default function Dashboard() {
  const { logout } = useAuth()

  const [songs, setSongs] = useState([])
  const [setlists, setSetlists] = useState([])
  const [selectedSetlistId, setSelectedSetlistId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)

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
  async function handleReorder(setlistId, songIds) { await reorderSetlist(setlistId, songIds); await loadData() }
  async function handleShare(setlistId) { return generateShareToken(setlistId) }

  const selectedSetlist = setlists.find((s) => s._id === selectedSetlistId) || null

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">찬양팀 악보 & 콘티 관리</p>
        </div>
        <button className="secondary" onClick={logout}>로그아웃</button>
      </header>

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
              <SongList songs={songs} onDelete={handleDeleteSong} />
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
        </>
      )}
    </div>
  )
}
