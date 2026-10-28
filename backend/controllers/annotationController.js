const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Setlist = require('../models/Setlist')
const User = require('../models/User')
const SheetAnnotation = require('../models/SheetAnnotation')
const { accessFilter } = require('../utils/access')
const { takeAttempt } = require('../utils/rateLimit')
const { checkSharePin, rejectPin } = require('../utils/sharePin')

// 악보 위 필기 공유
// - 보기: 공유 링크를 열 수 있는 사람이면 누구나 (공유 비밀번호 규칙 그대로)
// - 쓰기: 로그인했고 그 콘티에 접근할 수 있는 팀원만
const MAX_STROKES = 500
const MAX_POINTS = 2000
const MAX_BYTES = 300 * 1024
const WRITE_LIMIT = 120
const WRITE_WINDOW_MS = 5 * 60 * 1000
const TOOLS = ['pen', 'highlighter']
const COLOR = /^#[0-9a-fA-F]{6}$/
const STROKE_ID = /^[A-Za-z0-9_-]{1,40}$/

const NOT_FOUND = '콘티나 곡을 찾을 수 없습니다'
const isId = (v) => mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === String(v)
const round4 = (n) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000
const hasSong = (setlist, songId) => (setlist.songs || []).some((s) => s.toString() === songId)

function payload(doc) {
  return {
    strokes: doc ? doc.strokes.map((s) => ({ id: s.id, tool: s.tool, color: s.color, width: s.width, points: s.points })) : [],
    version: doc ? doc.version : 0,
    updatedAt: doc ? doc.updatedAt : null,
  }
}

// 받은 필기를 검사하고 정리한다 → { strokes } 또는 { error }
function cleanStrokes(input) {
  if (!Array.isArray(input)) return { error: '필기 형식이 올바르지 않습니다' }
  if (input.length > MAX_STROKES) return { error: `필기는 한 곡에 ${MAX_STROKES}획까지 저장할 수 있습니다. 일부를 지워 주세요` }
  const seen = new Set()
  const strokes = []
  for (const s of input) {
    if (!s || typeof s !== 'object') return { error: '필기 형식이 올바르지 않습니다' }
    const id = String(s.id || '')
    if (!STROKE_ID.test(id) || seen.has(id)) return { error: '필기 형식이 올바르지 않습니다' }
    seen.add(id)
    const tool = s.tool || 'pen'
    if (!TOOLS.includes(tool)) return { error: '필기 도구가 올바르지 않습니다' }
    if (typeof s.color !== 'string' || !COLOR.test(s.color)) return { error: '필기 색이 올바르지 않습니다' }
    const width = Number(s.width)
    if (!Number.isFinite(width) || width < 0.5 || width > 60) return { error: '필기 굵기가 올바르지 않습니다' }
    if (!Array.isArray(s.points) || s.points.length < 1) return { error: '필기 형식이 올바르지 않습니다' }
    if (s.points.length > MAX_POINTS) return { error: '한 획이 너무 깁니다. 나눠서 그려 주세요' }
    const points = []
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2) return { error: '필기 형식이 올바르지 않습니다' }
      const [x, y] = p
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
        return { error: '필기 형식이 올바르지 않습니다' }
      }
      points.push([round4(x), round4(y)])
    }
    strokes.push({ id, tool, color: s.color.toLowerCase(), width: Math.round(width * 10) / 10, points })
  }
  if (Buffer.byteLength(JSON.stringify(strokes)) > MAX_BYTES) {
    return { error: '필기가 너무 많아 저장할 수 없습니다. 일부를 지워 주세요' }
  }
  return { strokes }
}

// 로그인한 팀원이 접근할 수 있는 콘티 (없거나 권한이 없으면 null)
async function findMemberSetlist(user, setlistId) {
  return Setlist.findOne({ _id: setlistId, ...(await accessFilter(user)) }, 'songs')
}

// 공유 화면에서 로그인 정보가 함께 왔으면 확인한다. 잘못된 토큰이면 그냥 손님으로 본다
async function optionalUser(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')
    if (!user || user.mustChangePassword) return null
    return user
  } catch {
    return null
  }
}

// GET /api/annotations/public/:token/:songId — 공유 링크로 보는 사람 (x-share-pin 헤더)
// 로그인한 팀원이면 canEdit과 setlistId를 함께 알려 준다
exports.getPublicAnnotation = async (req, res) => {
  try {
    const { token, songId } = req.params
    if (!isId(songId)) return res.status(404).json({ message: NOT_FOUND })
    const setlist = await Setlist.findOne({ shareToken: token }, 'songs sharePinHash shareToken')
    if (!setlist) return res.status(404).json({ message: '유효하지 않은 링크입니다' })

    const user = await optionalUser(req)
    const member = user ? await findMemberSetlist(user, setlist._id) : null
    if (!member) {
      const pinResult = await checkSharePin(setlist, req)
      if (pinResult !== 'ok') return rejectPin(res, pinResult)
    }
    if (!hasSong(setlist, songId)) return res.status(404).json({ message: NOT_FOUND })

    const doc = await SheetAnnotation.findOne({ setlist: setlist._id, song: songId })
    res.json({
      ...payload(doc),
      canEdit: !!member,
      ...(member ? { setlistId: setlist._id } : {}),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/annotations/:setlistId/:songId — 로그인한 팀원
exports.getAnnotation = async (req, res) => {
  try {
    const { setlistId, songId } = req.params
    if (!isId(setlistId) || !isId(songId)) return res.status(404).json({ message: NOT_FOUND })
    const setlist = await findMemberSetlist(req.user, setlistId)
    if (!setlist || !hasSong(setlist, songId)) return res.status(404).json({ message: NOT_FOUND })
    const doc = await SheetAnnotation.findOne({ setlist: setlistId, song: songId })
    res.json({ ...payload(doc), canEdit: true, setlistId })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function writeGuard(req, res) {
  const { setlistId, songId } = req.params
  if (!isId(setlistId) || !isId(songId)) { res.status(404).json({ message: NOT_FOUND }); return false }
  if (!(await takeAttempt(`annotation:${req.user._id}`, WRITE_LIMIT, WRITE_WINDOW_MS))) {
    res.status(429).json({ message: '필기 저장이 너무 잦습니다. 잠시 후 다시 시도해 주세요' })
    return false
  }
  const setlist = await findMemberSetlist(req.user, setlistId)
  if (!setlist || !hasSong(setlist, songId)) { res.status(404).json({ message: NOT_FOUND }); return false }
  return true
}

// PUT /api/annotations/:setlistId/:songId  { strokes, baseVersion }
// baseVersion이 지금 저장된 판과 다르면(다른 사람이 먼저 저장) 409와 최신 필기를 돌려준다
exports.saveAnnotation = async (req, res) => {
  try {
    if (!(await writeGuard(req, res))) return
    const { setlistId, songId } = req.params
    const baseVersion = Number(req.body?.baseVersion)
    if (!Number.isInteger(baseVersion) || baseVersion < 0) return res.status(400).json({ message: 'baseVersion이 필요합니다' })
    const cleaned = cleanStrokes(req.body?.strokes)
    if (cleaned.error) return res.status(400).json({ message: cleaned.error })

    let doc = null
    try {
      doc = await SheetAnnotation.findOneAndUpdate(
        { setlist: setlistId, song: songId, version: baseVersion },
        { $set: { strokes: cleaned.strokes, updatedBy: req.user._id }, $inc: { version: 1 } },
        { new: true, upsert: baseVersion === 0 } // 처음 저장할 때만 새로 만든다
      )
    } catch (err) {
      if (err.code !== 11000) throw err // 동시에 처음 저장 → 먼저 만든 쪽이 이김
    }
    if (!doc) {
      const current = await SheetAnnotation.findOne({ setlist: setlistId, song: songId })
      return res.status(409).json({ message: '다른 사람이 먼저 필기를 고쳤습니다', conflict: true, ...payload(current) })
    }
    res.json(payload(doc))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/annotations/:setlistId/:songId — 전체 지우기 (판 번호는 이어서 올린다)
exports.clearAnnotation = async (req, res) => {
  try {
    if (!(await writeGuard(req, res))) return
    const { setlistId, songId } = req.params
    const doc = await SheetAnnotation.findOneAndUpdate(
      { setlist: setlistId, song: songId },
      { $set: { strokes: [], updatedBy: req.user._id }, $inc: { version: 1 } },
      { new: true }
    )
    res.json(payload(doc))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
