const mongoose = require('mongoose')
const crypto = require('crypto')
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
exports.getPublicSetlist = async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ shareToken: req.params.token }).populate('songs')
    if (!setlist) return res.status(404).json({ message: '유효하지 않은 링크입니다' })

    res.json({
      name: setlist.name,
      songs: setlist.songs.map(s => ({
        _id: s._id,
        title: s.title,
        artist: s.artist,
        key: s.key,
        bpm: s.bpm,
        youtubeUrl: s.youtubeUrl,
        mrUrl: s.mrUrl,
        sheetImageUrl: s.sheetImageUrl,
        sheetPdfUrl: s.sheetPdfUrl,
        notes: s.notes,
      }))
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

    await setlist.save()

    res.json(await populateSetlist(setlist._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
