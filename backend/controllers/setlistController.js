const mongoose = require('mongoose')
const crypto = require('crypto')
const Setlist = require('../models/Setlist')

// In-memory current song index per share token (resets on server restart)
const currentSongMap = new Map()

// CREATE SETLIST
exports.createSetlist = async (req, res) => {
  try {
    const setlist = await Setlist.create({
      ...req.body,
      user: req.user._id,
    })
    res.status(201).json(setlist)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET USER SETLISTS
exports.getSetlists = async (req, res) => {
  try {
    const setlists = await Setlist
      .find({ user: req.user._id })
      .populate('songs')

    res.json(setlists)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// UPDATE SETLIST DETAILS
exports.updateSetlist = async (req, res) => {
  try {
    const cleanId = String(req.params.id).trim().replace(/^"|"$/g, '')

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.status(400).json({ message: `Invalid setlist id: ${cleanId}` })
    }

    const setlist = await Setlist.findOne({
      _id: cleanId,
      user: req.user._id,
    })

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

// 🔥 ADD SONGS TO SETLIST (THIS WAS MISSING)
exports.addSongsToSetlist = async (req, res) => {
  try {
    const { songIds } = req.body

    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: 'songIds must be an array' })
    }

    const setlist = await Setlist.findOne({
      _id: req.params.id,
      user: req.user._id,
    })

    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }

    // prevent duplicates
    const existing = setlist.songs.map(id => id.toString())
    const toAdd = songIds.filter(id => !existing.includes(id))

    setlist.songs.push(...toAdd)

    await setlist.save()

    const populated = await Setlist.findById(setlist._id).populate('songs')

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE SETLIST
exports.deleteSetlist = async (req, res) => {
  try {
    const cleanId = String(req.params.id).trim().replace(/^"|"$/g, '')

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.status(400).json({ message: `Invalid setlist id: ${cleanId}` })
    }

    const deletedSetlist = await Setlist.findOneAndDelete({
      _id: cleanId,
      user: req.user._id,
    })

    if (!deletedSetlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }

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

    const setlist = await Setlist.findOne({ _id: req.params.id, user: req.user._id })
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    setlist.songs = songIds
    await setlist.save()
    const populated = await Setlist.findById(setlist._id).populate('songs')
    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GENERATE / GET SHARE TOKEN
exports.getShareToken = async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ _id: req.params.id, user: req.user._id })
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
  const index = currentSongMap.get(req.params.token) ?? 0
  res.json({ index })
}

// SET current song index for public share (anyone with link can control)
exports.setPublicCurrentSong = async (req, res) => {
  const { index } = req.body
  if (typeof index !== 'number') return res.status(400).json({ message: 'index required' })
  currentSongMap.set(req.params.token, index)
  res.json({ index })
}

exports.removeSongFromSetlist = async (req, res) => {
  try {
    const { songId } = req.body

    if (!songId) {
      return res.status(400).json({ message: 'songId is required' })
    }

    const setlist = await Setlist.findOne({
      _id: req.params.id,
      user: req.user._id,
    })

    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }

    setlist.songs = setlist.songs.filter(
      (id) => id.toString() !== songId.toString()
    )

    await setlist.save()

    const populated = await Setlist.findById(setlist._id).populate('songs')

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

