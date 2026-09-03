const Song = require('../models/Song')

const SONG_FIELDS = ['title', 'artist', 'key', 'bpm', 'capo', 'youtubeUrl', 'mrUrl', 'sheetImageUrl', 'sheetPdfUrl', 'structure', 'notes']

exports.getSongs = async (req, res) => {
  try {
    const songs = await Song.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json(songs)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getSongById = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, user: req.user._id })
    if (!song) return res.status(404).json({ message: '곡을 찾을 수 없습니다' })
    res.json(song)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.createSong = async (req, res) => {
  try {
    const { title } = req.body
    if (!title) return res.status(400).json({ message: '제목은 필수입니다' })

    const data = { user: req.user._id }
    SONG_FIELDS.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f] })

    const song = await Song.create(data)
    res.status(201).json(song)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.updateSong = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, user: req.user._id })
    if (!song) return res.status(404).json({ message: '곡을 찾을 수 없습니다' })

    SONG_FIELDS.forEach((f) => { if (req.body[f] !== undefined) song[f] = req.body[f] })

    const updated = await song.save()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.deleteSong = async (req, res) => {
  try {
    const deleted = await Song.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    if (!deleted) return res.status(404).json({ message: '곡을 찾을 수 없습니다' })
    res.json({ message: '곡이 삭제되었습니다' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
