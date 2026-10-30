const crypto = require('crypto')
const CopyrightRequest = require('../models/CopyrightRequest')
const BlockedSheet = require('../models/BlockedSheet')
const Setlist = require('../models/Setlist')
const { takeAttempt, clientIp } = require('../utils/rateLimit')
const { isOperator } = require('../utils/operator')
const { effectiveSheets } = require('../utils/sheets')
const optionalUser = require('../utils/optionalUser')

// 저작권 침해 신고(삭제 요청) 창구
// - 누구나 로그인 없이 신고한다 → 접수 번호를 돌려준다
// - 운영자(ADMIN_EMAILS)가 보고, 해당 악보 파일을 '차단'한다 (파일은 지우지 않으므로 풀면 돌아온다)

const ROLES = ['owner', 'agent', 'publisher', 'other']
const STATUSES = ['received', 'reviewing', 'blocked', 'rejected', 'resolved']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SHARE_RE = /\/share\/([a-f0-9]{32})/i
const FILE_RE = /\/api\/sheets\/([A-Za-z0-9_-]{20,100})/g
const FILE_ID = /^[A-Za-z0-9_-]{20,100}$/
const SUBMIT_LIMIT = 5 // IP마다 1시간에 5건
const str = (v, max) => String(v ?? '').trim().slice(0, max)

const fail = (res, status, message) => res.status(status).json({ message })

function newReceipt() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `C${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

// POST /api/copyright/requests  (로그인 없이)
exports.submit = async (req, res) => {
  try {
    const b = req.body || {}
    const name = str(b.name, 60)
    const email = str(b.email, 120).toLowerCase()
    const work = str(b.work, 200)
    const location = str(b.location, 1000)
    const details = str(b.details, 3000)
    const role = ROLES.includes(b.role) ? b.role : 'other'
    if (!name) return fail(res, 400, '이름(또는 회사 이름)을 적어 주세요')
    if (!EMAIL.test(email)) return fail(res, 400, '답변을 받을 이메일 주소를 적어 주세요')
    if (!work) return fail(res, 400, '곡 제목(저작물)을 적어 주세요')
    if (!location && !details) return fail(res, 400, '악보를 찾을 수 있도록 공유 링크나 설명을 적어 주세요')
    if (b.statement !== true) return fail(res, 400, '권리자(또는 대리인)이며 사실대로 적었다는 확인에 체크해 주세요')

    const ip = clientIp(req)
    if (!(await takeAttempt(`copyright:${ip}`, SUBMIT_LIMIT, 60 * 60 * 1000))) {
      return fail(res, 429, '짧은 시간에 신고가 너무 많습니다. 1시간 뒤에 다시 보내 주세요')
    }

    const text = `${location}\n${details}`
    const doc = await CopyrightRequest.create({
      receipt: newReceipt(),
      name, email, role, work, location, details,
      shareToken: (text.match(SHARE_RE) || [])[1]?.toLowerCase() || '',
      fileIds: [...new Set([...text.matchAll(FILE_RE)].map((m) => m[1]))].slice(0, 30),
      ipHash: crypto.createHash('sha256').update(`${ip}\n${process.env.JWT_SECRET || ''}`).digest('hex').slice(0, 24),
    })
    res.status(201).json({ receipt: doc.receipt, message: '신고가 접수되었습니다. 확인 후 적어 주신 이메일로 연락드리겠습니다.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/copyright/operator → { operator, open } (로그인하지 않았으면 operator: false)
exports.operatorInfo = async (req, res) => {
  try {
    const user = await optionalUser(req)
    if (!isOperator(user)) return res.json({ operator: false })
    const open = await CopyrightRequest.countDocuments({ status: { $in: ['received', 'reviewing'] } })
    res.json({ operator: true, open })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/copyright/admin/requests?status=
exports.list = async (req, res) => {
  try {
    const filter = STATUSES.includes(req.query.status) ? { status: req.query.status } : {}
    const list = await CopyrightRequest.find(filter, '-ipHash').sort({ createdAt: -1 }).limit(200).lean()
    res.json(list)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const fileIdOf = (url) => (String(url || '').match(/^\/api\/sheets\/([A-Za-z0-9_-]{20,100})$/) || [])[1] || ''

// GET /api/copyright/admin/requests/:id → 신고 + 찾아낸 콘티·곡·악보 파일(차단 여부)
exports.detail = async (req, res) => {
  try {
    const request = await CopyrightRequest.findById(req.params.id, '-ipHash').lean().catch(() => null)
    if (!request) return fail(res, 404, '신고를 찾을 수 없습니다')

    let setlist = null
    const fileIds = new Set(request.fileIds)
    const songs = []
    if (request.shareToken) {
      const s = await Setlist.findOne({ shareToken: request.shareToken }).populate('songs').populate('team', 'name').lean()
      if (s) {
        setlist = { _id: s._id, name: s.name, team: s.team?.name || '(개인 콘티)', shareOpen: s.shareOpen !== false, hasSharePin: !!s.sharePinHash }
        for (const song of s.songs || []) {
          const pages = effectiveSheets(song).flatMap((sh) => sh.pages.map((p, n) => ({ sheet: sh.label || sh.key || '', pageNo: n + 1, type: p.type, url: p.url, fileId: fileIdOf(p.url) })))
          pages.forEach((p) => p.fileId && fileIds.add(p.fileId))
          songs.push({ _id: song._id, title: song.title, artist: song.artist || '', pages })
        }
      }
    }
    const blocked = new Set((await BlockedSheet.find({ fileId: { $in: [...fileIds] } }, 'fileId').lean()).map((b) => b.fileId))
    songs.forEach((s) => s.pages.forEach((p) => { p.blocked = blocked.has(p.fileId) }))
    res.json({
      request,
      setlist,
      songs,
      files: [...fileIds].map((fileId) => ({ fileId, blocked: blocked.has(fileId) })),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/copyright/admin/requests/:id  { status, operatorNote }
exports.update = async (req, res) => {
  try {
    const set = { handledBy: req.user.email, handledAt: new Date() }
    if (req.body?.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) return fail(res, 400, '처리 상태가 올바르지 않습니다')
      set.status = req.body.status
    }
    if (req.body?.operatorNote !== undefined) set.operatorNote = str(req.body.operatorNote, 2000)
    const doc = await CopyrightRequest.findByIdAndUpdate(req.params.id, set, { new: true, projection: '-ipHash' }).catch(() => null)
    if (!doc) return fail(res, 404, '신고를 찾을 수 없습니다')
    res.json(doc)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/copyright/admin/blocks  { fileIds: [], requestId } — 악보 파일 차단 (지우지 않는다)
exports.block = async (req, res) => {
  try {
    const ids = [...new Set((req.body?.fileIds || []).map(String))].filter((id) => FILE_ID.test(id)).slice(0, 100)
    if (!ids.length) return fail(res, 400, '차단할 악보 파일을 골라 주세요')
    const request = req.body?.requestId ? await CopyrightRequest.findById(req.body.requestId).catch(() => null) : null
    await BlockedSheet.bulkWrite(ids.map((fileId) => ({
      updateOne: { filter: { fileId }, update: { $setOnInsert: { fileId, request: request?._id || null, blockedBy: req.user.email } }, upsert: true },
    })))
    if (request) {
      request.status = 'blocked'
      request.handledBy = req.user.email
      request.handledAt = new Date()
      await request.save()
    }
    res.json({ blocked: ids })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/copyright/admin/blocks/:fileId — 차단 풀기 (신고가 잘못됐을 때)
exports.unblock = async (req, res) => {
  try {
    const r = await BlockedSheet.deleteOne({ fileId: req.params.fileId })
    res.json({ unblocked: r.deletedCount > 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/copyright/admin/requests/:id/lock-share — 신고된 공유 링크를 팀원 전용으로 잠근다
exports.lockShare = async (req, res) => {
  try {
    const request = await CopyrightRequest.findById(req.params.id).catch(() => null)
    if (!request?.shareToken) return fail(res, 404, '이 신고에는 공유 링크가 없습니다')
    const s = await Setlist.findOneAndUpdate({ shareToken: request.shareToken }, { shareOpen: false, sharePinHash: null }, { new: true })
    if (!s) return fail(res, 404, '공유 링크의 콘티를 찾을 수 없습니다')
    res.json({ shareOpen: false, hasSharePin: false })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
