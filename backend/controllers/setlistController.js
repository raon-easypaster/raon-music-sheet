const mongoose = require('mongoose')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const Setlist = require('../models/Setlist')
const Song = require('../models/Song')
const PinAttempt = require('../models/PinAttempt')
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
// 공유 비밀번호가 걸린 콘티는 x-share-pin 헤더가 맞아야 한다 → 'ok' | 'wrong' | 'locked'
// - 기기(IP)마다 5번 틀리면 그 기기만 15분 잠금 (다른 팀원은 영향 없음)
// - 여러 기기에서 합쳐 30번 틀리면 링크 전체 잠금. 잠길 때마다 시간이 두 배(15분→30분→1시간…최대 24시간)가 된다.
//   새 비밀번호는 6자리 이상이라 하루 30번으로는 맞히는 데 수십 년이 걸리므로, 무기한 잠금은 두지 않는다
//   (누군가 일부러 틀려도 팀이 영영 못 쓰게 되지 않도록)
// - 시도는 비밀번호를 확인하기 "전에" 원자적으로 하나씩 예약하므로, 동시에 많이 보내도 한도를 넘지 못한다
const PIN_LOCK_MS = 15 * 60 * 1000
const PIN_MAX_LOCK_MS = 24 * 60 * 60 * 1000
const PIN_LIMITS = { ip: 5, link: 30 }

// Vercel은 X-Forwarded-For를 실제 접속 주소로 덮어쓰므로(위조 불가) 이것을 먼저 쓴다.
// (다른 곳에 배포한다면 그 환경이 이 헤더를 덮어쓰는지 확인해야 한다)
const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '')
    .split(',')[0].trim()

// 시도 하나를 예약한다 → 'ok' | 'locked'
// escalate: 링크 전체 기록이면 잠길 때마다 잠금 시간을 늘린다 (최대 24시간)
async function reserveAttempt(key, limit, escalate = false) {
  const now = new Date()
  // 링크 기록은 잠금 이력을 기억해야 하므로 오래 보관한다
  const keepUntil = new Date(now.getTime() + (escalate ? 7 * PIN_MAX_LOCK_MS : PIN_LOCK_MS * 2))
  let doc
  try {
    doc = await PinAttempt.findOneAndUpdate(
      { key, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
      { $inc: { attempts: 1 }, $set: { expireAt: keepUntil, lockedUntil: null } },
      { new: true, upsert: true }
    )
  } catch (err) {
    if (err.code !== 11000) throw err // 11000 = 잠긴 문서가 있어 새로 만들 수 없음 = 잠김
    return 'locked'
  }
  if (doc.attempts <= limit) return 'ok'

  const lockCount = (doc.lockCount || 0) + 1
  const lockMs = escalate ? Math.min(PIN_LOCK_MS * 2 ** (lockCount - 1), PIN_MAX_LOCK_MS) : PIN_LOCK_MS
  await PinAttempt.updateOne({ key }, { attempts: 0, lockCount, lockedUntil: new Date(now.getTime() + lockMs), expireAt: keepUntil })
  return 'locked'
}

async function checkSharePin(setlist, req) {
  if (!setlist.sharePinHash) return 'ok'
  const pin = String(req.headers['x-share-pin'] || '')
  if (!pin) return 'wrong' // 아직 비밀번호를 넣지 않은 첫 방문은 시도로 세지 않는다

  const ipKey = `ip:${setlist.shareToken}:${clientIp(req)}`
  const linkKey = `link:${setlist.shareToken}`
  const ipResult = await reserveAttempt(ipKey, PIN_LIMITS.ip)
  if (ipResult !== 'ok') return ipResult
  const linkResult = await reserveAttempt(linkKey, PIN_LIMITS.link, true)
  if (linkResult !== 'ok') return linkResult

  if (await bcrypt.compare(pin, setlist.sharePinHash)) {
    // 맞히면 이 기기의 기록은 지우고, 링크 전체 횟수에서는 이번 시도를 되돌린다
    await PinAttempt.deleteOne({ key: ipKey })
    await PinAttempt.updateOne({ key: linkKey, attempts: { $gt: 0 } }, { $inc: { attempts: -1 } })
    return 'ok'
  }
  return 'wrong'
}

function rejectPin(res, result) {
  if (result === 'locked') {
    return res.status(429).json({ message: '비밀번호를 여러 번 틀려 15분 동안 잠겼습니다. 잠시 후 다시 시도하거나, 공유한 분에게 비밀번호를 새로 걸어 달라고 해 주세요', needPin: true, locked: true })
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
  const guarded = await Setlist.findOne({ shareToken: token }, 'sharePinHash shareToken')
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
    if (pin && !/^\d{6,8}$/.test(pin)) {
      return res.status(400).json({ message: '공유 비밀번호는 숫자 6~8자리로 정해 주세요' })
    }
    setlist.sharePinHash = pin ? await bcrypt.hash(pin, await bcrypt.genSalt(10)) : null
    await setlist.save()
    // 비밀번호를 새로 걸거나 해제하면 이 링크의 잠금 기록도 모두 지운다
    if (setlist.shareToken) {
      await PinAttempt.deleteMany({ key: { $in: [`link:${setlist.shareToken}`] } })
      await PinAttempt.deleteMany({ key: { $regex: `^ip:${setlist.shareToken}:` } })
    }
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
