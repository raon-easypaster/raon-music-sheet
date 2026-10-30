const Song = require('../models/Song')
const { resolveWorkspace, accessFilter, isTeamOwner, FORBIDDEN_WORKSPACE } = require('../utils/access')

const User = require('../models/User')
const { cleanSongMeta, tempoFromBpm } = require('../utils/songMeta')
const { cleanSheets, mirrorFields } = require('../utils/sheets')
const { checkFileUse } = require('../utils/sheetAccess')

const SONG_FIELDS = ['title', 'artist', 'key', 'bpm', 'capo', 'youtubeUrl', 'mrUrl', 'sheetImageUrl', 'sheetPdfUrl', 'structure', 'notes']

// 악보 목록(sheets)을 보냈으면 검사해서 넣고, 예전 칸(sheetImageUrl·sheetPdfUrl)을 첫 악보에 맞춘다
// 보내지 않았으면 예전 방식 그대로 (data30.json·예전 화면)
function applySheets(target, body) {
  if (body.sheets === undefined) return null
  const cleaned = cleanSheets(body.sheets)
  if (cleaned.error) return cleaned.error
  target.sheets = cleaned.sheets
  Object.assign(target, mirrorFields(cleaned.sheets))
  return null
}

// GET /songs?team=<팀 id>  (team이 없으면 내 개인 곡)
exports.getSongs = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.query.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const songs = await Song.find(ws.filter).populate('user', 'email').sort({ createdAt: -1 }).lean()
    const favorites = new Set((req.user.favoriteSongs || []).map((id) => id.toString()))
    res.json(songs.map((song) => ({ ...song, isFavorite: favorites.has(song._id.toString()) })))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getSongById = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, ...(await accessFilter(req.user)) })
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

    const ws = await resolveWorkspace(req.user, req.body.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const data = { user: req.user._id, team: ws.team ? ws.team._id : null }
    SONG_FIELDS.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f] })
    Object.assign(data, cleanSongMeta(req.body))
    if (!data.tempo) data.tempo = tempoFromBpm(data.bpm)
    const sheetError = applySheets(data, req.body)
    if (sheetError) return res.status(400).json({ message: sheetError })
    const fileError = await checkFileUse(req.user, data, null)
    if (fileError) return res.status(403).json({ message: fileError })

    const song = await Song.create(data)
    res.status(201).json(song)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// 팀 곡은 팀원 누구나 수정 가능
exports.updateSong = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, ...(await accessFilter(req.user)) })
    if (!song) return res.status(404).json({ message: '곡을 찾을 수 없습니다' })
    const before = song.toObject()

    SONG_FIELDS.forEach((f) => { if (req.body[f] !== undefined) song[f] = req.body[f] })
    Object.assign(song, cleanSongMeta(req.body))
    if (!song.tempo) song.tempo = tempoFromBpm(song.bpm)
    const sheetError = applySheets(song, req.body)
    if (sheetError) return res.status(400).json({ message: sheetError })
    const fileError = await checkFileUse(req.user, song, before)
    if (fileError) return res.status(403).json({ message: fileError })

    const updated = await song.save()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// 팀 곡은 팀장만 삭제할 수 있다 (팀원은 추가·수정만). 개인 곡은 본인이 삭제
exports.deleteSong = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, ...(await accessFilter(req.user)) })
    if (!song) return res.status(404).json({ message: '곡을 찾을 수 없습니다' })
    if (song.team && !(await isTeamOwner(req.user, song.team))) {
      return res.status(403).json({ message: '팀 곡은 팀장만 삭제할 수 있습니다' })
    }

    await song.deleteOne()
    res.json({ message: '곡이 삭제되었습니다' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /songs/:id/favorite  { favorite: true | false } — 내 즐겨찾기에 넣거나 뺀다
exports.setFavorite = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, ...(await accessFilter(req.user)) }, '_id')
    if (!song) return res.status(404).json({ message: '곡을 찾을 수 없습니다' })

    const favorite = req.body.favorite !== false
    await User.updateOne(
      { _id: req.user._id },
      favorite ? { $addToSet: { favoriteSongs: song._id } } : { $pull: { favoriteSongs: song._id } }
    )
    res.json({ _id: song._id, isFavorite: favorite })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /songs/themes/rename { team, from, to } — 작업 공간의 모든 곡에서 주제 이름을 바꾼다 (to가 비면 그 주제를 뺀다)
exports.renameTheme = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.body.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const from = String(req.body.from ?? '').trim()
    const to = String(req.body.to ?? '').trim().replace(/^#/, '').slice(0, 20)
    if (!from || from.length > 20) return res.status(400).json({ message: '바꿀 주제를 골라 주세요' })
    if (from === to) return res.json({ updated: 0 })

    const songs = await Song.find({ ...ws.filter, themes: from }, 'themes').lean()
    const ops = songs.map((s) => {
      const next = []
      for (const t of s.themes) {
        const v = t === from ? to : t
        if (v && !next.includes(v)) next.push(v)
      }
      return { updateOne: { filter: { _id: s._id }, update: { $set: { themes: next } } } }
    })
    if (ops.length) await Song.bulkWrite(ops)
    res.json({ updated: ops.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
