const mongoose = require('mongoose')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const Setlist = require('../models/Setlist')
const Song = require('../models/Song')
const { resolveWorkspace, accessFilter, canDelete, FORBIDDEN_WORKSPACE } = require('../utils/access')

// In-memory current song index per share token (resets on server restart)
const currentSongMap = new Map()

function cleanSetlistId(raw) {
  const cleanId = String(raw).trim().replace(/^"|"$/g, '')
  return mongoose.Types.ObjectId.isValid(cleanId) ? cleanId : null
}

// 내가 접근할 수 있는 콘티 (개인 콘티 또는 내가 속한 팀의 콘티)
async function findAccessibleSetlist(req) {
  const id = cleanSetlistId(req.params.id)
  if (!id) return null
  return Setlist.findOne({ _id: id, ...(await accessFilter(req.user)) })
}

// 콘티와 같은 작업 공간의 곡만 담을 수 있다
async function sameWorkspaceSongIds(setlist, songIds) {
  const scope = setlist.team ? { team: setlist.team } : { user: setlist.user, team: null }
  const validIds = songIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
  const songs = await Song.find({ _id: { $in: validIds }, ...scope }, '_id')
  const allowed = new Set(songs.map((s) => s._id.toString()))
  return validIds.filter((id) => allowed.has(String(id)))
}

const populateSetlist = (id) => Setlist.findById(id).populate('songs').populate('user', 'email')

// CREATE SETLIST
exports.createSetlist = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.body.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const { name, venue, gigDate, notes } = req.body
    const setlist = await Setlist.create({
      name,
      venue,
      gigDate,
      notes,
      user: req.user._id,
      team: ws.team ? ws.team._id : null,
    })
    res.status(201).json(setlist)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET SETLISTS — /setlists?team=<팀 id> (team이 없으면 내 개인 콘티)
exports.getSetlists = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.query.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const setlists = await Setlist
      .find(ws.filter)
      .populate('songs')
      .populate('user', 'email')
      .sort({ createdAt: -1 })

    res.json(setlists)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// UPDATE SETLIST DETAILS
exports.updateSetlist = async (req, res) => {
  try {
    if (!cleanSetlistId(req.params.id)) {
      return res.status(400).json({ message: `Invalid setlist id: ${req.params.id}` })
    }

    const setlist = await findAccessibleSetlist(req)
    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }

    setlist.name = req.body.name ?? setlist.name
    setlist.venue = req.body.venue ?? setlist.venue
    setlist.gigDate = req.body.gigDate ?? setlist.gigDate
    setlist.notes = req.body.notes ?? setlist.notes

    const updatedSetlist = await setlist.save()
    res.json(updatedSetlist)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ADD SONGS TO SETLIST
exports.addSongsToSetlist = async (req, res) => {
  try {
    const { songIds } = req.body

    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: 'songIds must be an array' })
    }

    const setlist = await findAccessibleSetlist(req)
    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }

    // prevent duplicates, and only songs from the same workspace
    const existing = setlist.songs.map(id => id.toString())
    const allowed = await sameWorkspaceSongIds(setlist, songIds)
    const toAdd = allowed.filter(id => !existing.includes(String(id)))

    setlist.songs.push(...toAdd)

    await setlist.save()

    res.json(await populateSetlist(setlist._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE SETLIST — 만든 사람 또는 팀장만
exports.deleteSetlist = async (req, res) => {
  try {
    if (!cleanSetlistId(req.params.id)) {
      return res.status(400).json({ message: `Invalid setlist id: ${req.params.id}` })
    }

    const setlist = await findAccessibleSetlist(req)
    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }
    if (!(await canDelete(req.user, setlist))) {
      return res.status(403).json({ message: '콘티를 만든 사람이나 팀장만 삭제할 수 있습니다' })
    }

    await setlist.deleteOne()
    res.json({ message: 'Setlist deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// REORDER SONGS
exports.reorderSongs = async (req, res) => {
  try {
    const { songIds } = req.body
    if (!Array.isArray(songIds)) return res.status(400).json({ message: 'songIds must be an array' })

    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    setlist.songs = await sameWorkspaceSongIds(setlist, songIds)
    await setlist.save()
    res.json(await populateSetlist(setlist._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GENERATE / GET SHARE TOKEN
exports.getShareToken = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    if (!setlist.shareToken) {
      setlist.shareToken = crypto.randomBytes(16).toString('hex')
      await setlist.save()
    }
    res.json({ shareToken: setlist.shareToken })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUBLIC VIEW BY TOKEN (no auth)
// 공유 비밀번호가 걸린 콘티는 x-share-pin 헤더가 맞아야 한다.
// 5번 틀리면 15분 동안 잠근다 → 'ok' | 'wrong' | 'locked'
const PIN_MAX_FAILURES = 5
const PIN_LOCK_MS = 15 * 60 * 1000

async function checkSharePin(setlist, req) {
  if (!setlist.sharePinHash) return 'ok'
  if (setlist.sharePinLockedUntil && setlist.sharePinLockedUntil > new Date()) return 'locked'

  const pin = String(req.headers['x-share-pin'] || '')
  if (!pin) return 'wrong' // 아직 비밀번호를 넣지 않은 첫 방문은 실패로 세지 않는다

  if (await bcrypt.compare(pin, setlist.sharePinHash)) {
    if (setlist.sharePinFailures) await Setlist.updateOne({ _id: setlist._id }, { sharePinFailures: 0, sharePinLockedUntil: null })
    return 'ok'
  }
  const failures = (setlist.sharePinFailures || 0) + 1
  await Setlist.updateOne(
    { _id: setlist._id },
    failures >= PIN_MAX_FAILURES
      ? { sharePinFailures: 0, sharePinLockedUntil: new Date(Date.now() + PIN_LOCK_MS) }
      : { sharePinFailures: failures }
  )
  return failures >= PIN_MAX_FAILURES ? 'locked' : 'wrong'
}

function rejectPin(res, result) {
  if (result === 'locked') {
    return res.status(429).json({ message: '비밀번호를 여러 번 틀려 15분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요', needPin: true, locked: true })
  }
  return res.status(401).json({ message: '이 콘티는 비밀번호가 필요합니다', needPin: true })
}

exports.getPublicSetlist = async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ shareToken: req.params.token }).populate('songs')
    if (!setlist) return res.status(404).json({ message: '유효하지 않은 링크입니다' })
    const pinResult = await checkSharePin(setlist, req)
    if (pinResult !== 'ok') return rejectPin(res, pinResult)

    const settings = new Map((setlist.songSettings || []).map((s) => [s.song.toString(), s]))
    res.json({
      name: setlist.name,
      gigDate: setlist.gigDate || null,
      songs: setlist.songs.map(s => {
        const own = settings.get(s._id.toString())
        return {
          _id: s._id,
          title: s.title,
          artist: s.artist,
          key: own?.key || s.key,
          bpm: s.bpm,
          youtubeUrl: s.youtubeUrl,
          mrUrl: s.mrUrl,
          sheetImageUrl: s.sheetImageUrl,
          sheetPdfUrl: s.sheetPdfUrl,
          structure: s.structure,
          notes: [own?.notes, s.notes].filter(Boolean).join('\n'),
        }
      })
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET current song index for public share
exports.getPublicCurrentSong = async (req, res) => {
  const token = req.params.token
  if (currentSongMap.has(token)) {
    return res.json({ index: currentSongMap.get(token) })
  }
  try {
    const setlist = await Setlist.findOne({ shareToken: token }, 'currentSongIdx')
    const index = setlist ? (setlist.currentSongIdx ?? 0) : 0
    currentSongMap.set(token, index)
    res.json({ index })
  } catch {
    res.json({ index: 0 })
  }
}

// SET current song index for public share (anyone with link can control)
exports.setPublicCurrentSong = async (req, res) => {
  const { index } = req.body
  if (typeof index !== 'number') return res.status(400).json({ message: 'index required' })
  const token = req.params.token
  const guarded = await Setlist.findOne({ shareToken: token }, 'sharePinHash sharePinFailures sharePinLockedUntil')
  if (guarded) {
    const pinResult = await checkSharePin(guarded, req)
    if (pinResult !== 'ok') return rejectPin(res, pinResult)
  }
  currentSongMap.set(token, index)
  Setlist.updateOne({ shareToken: token }, { currentSongIdx: index }).catch(() => {})
  res.json({ index })
}

exports.removeSongFromSetlist = async (req, res) => {
  try {
    const { songId } = req.body

    if (!songId) {
      return res.status(400).json({ message: 'songId is required' })
    }

    const setlist = await findAccessibleSetlist(req)
    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }

    setlist.songs = setlist.songs.filter(
      (id) => id.toString() !== songId.toString()
    )
    setlist.songSettings = (setlist.songSettings || []).filter(
      (s) => s.song.toString() !== songId.toString()
    )

    await setlist.save()

    res.json(await populateSetlist(setlist._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/:id/duplicate — 같은 작업 공간에 곡·순서·콘티별 설정까지 복사한 새 콘티를 만든다
exports.duplicateSetlist = async (req, res) => {
  try {
    const source = await findAccessibleSetlist(req)
    if (!source) return res.status(404).json({ message: 'Setlist not found' })

    const copy = await Setlist.create({
      name: (req.body.name || '').trim() || `${source.name} (복사)`,
      gigDate: req.body.gigDate || null,
      venue: source.venue,
      notes: source.notes,
      songs: source.songs,
      songSettings: source.songSettings,
      team: source.team,
      user: req.user._id,
    })
    res.status(201).json(await populateSetlist(copy._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/song-settings/:songId  { key, notes } — 이 콘티에서만 쓸 Key·메모 (둘 다 비우면 원래대로)
exports.updateSongSettings = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    const songId = String(req.params.songId)
    if (!setlist.songs.some((id) => id.toString() === songId)) {
      return res.status(404).json({ message: '이 콘티에 없는 곡입니다' })
    }

    const key = String(req.body.key || '').trim().slice(0, 10)
    const notes = String(req.body.notes || '').trim().slice(0, 1000)
    const others = (setlist.songSettings || []).filter((s) => s.song.toString() !== songId)
    setlist.songSettings = key || notes ? [...others, { song: songId, key, notes }] : others
    await setlist.save()

    res.json(await populateSetlist(setlist._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/share-pin  { pin } — 숫자 4~8자리. 빈 값이면 비밀번호를 해제한다
exports.setSharePin = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    const pin = String(req.body.pin ?? '').trim()
    if (pin && !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ message: '공유 비밀번호는 숫자 4~8자리로 정해 주세요' })
    }
    setlist.sharePinHash = pin ? await bcrypt.hash(pin, await bcrypt.genSalt(10)) : null
    setlist.sharePinFailures = 0
    setlist.sharePinLockedUntil = null
    await setlist.save()
    res.json({ hasSharePin: !!pin })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/current  { index } — 로그인한 팀원이 콘티 화면에서 곡을 넘길 때 (공유 비밀번호 없이)
exports.setCurrentSong = async (req, res) => {
  try {
    const { index } = req.body
    if (typeof index !== 'number') return res.status(400).json({ message: 'index required' })
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    if (setlist.shareToken) currentSongMap.set(setlist.shareToken, index)
    setlist.currentSongIdx = index
    await setlist.save()
    res.json({ index })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
