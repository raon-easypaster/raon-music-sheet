const jwt = require('jsonwebtoken')
const Song = require('../models/Song')
const Setlist = require('../models/Setlist')
const SheetFile = require('../models/SheetFile')
const User = require('../models/User')
const optionalUser = require('./optionalUser')
const { accessFilter } = require('./access')
const { isOperator } = require('./operator')

// 앱에 올린 악보 파일(/api/sheets/:fileId)은 볼 권한이 있는 사람에게만 보낸다.
// <img>·PDF 보기는 로그인 헤더를 붙일 수 없으므로, 악보 파일 주소에만 쓰는 쿠키 두 개로 확인한다.
// - raon_sv: 로그인한 사람 (로그인 정보가 붙은 요청마다 서버가 새로 맞춰 둔다)
// - raon_ss: 이 기기에서 열어 본 공유 링크 (공유 화면이 열릴 때마다 더한다, 최근 20개)
// 쿠키는 HttpOnly(화면 코드에서 읽을 수 없음) · SameSite=Lax · 경로 /api/sheets 로만 보낸다.
const USER_COOKIE = 'raon_sv'
const SHARE_COOKIE = 'raon_ss'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const RENEW_BEFORE_S = 7 * 24 * 60 * 60 // 만료 7일 전이면 새로 준다
const MAX_SHARES = 20
const AUD = 'sheets'

function readCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function cookieOptions(req) {
  const https = req.secure || String(req.headers['x-forwarded-proto'] || '').startsWith('https')
  return { httpOnly: true, sameSite: 'lax', secure: https, path: '/api/sheets', maxAge: MAX_AGE_MS }
}

function verify(value) {
  try { return jwt.verify(value, process.env.JWT_SECRET, { audience: AUD }) } catch { return null }
}

// 로그인한 사람의 악보 쿠키를 맞춰 둔다 (없거나, 다른 사람 것이거나, 곧 만료되면 새로)
function ensureUserCookie(req, res, user) {
  if (!user || res.headersSent) return
  const cur = verify(readCookies(req)[USER_COOKIE])
  if (cur && cur.id === String(user._id) && cur.exp - Date.now() / 1000 > RENEW_BEFORE_S) return
  const value = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { audience: AUD, expiresIn: '30d' })
  res.cookie(USER_COOKIE, value, cookieOptions(req))
}

// 공유 화면을 연 기기에 그 공유 링크를 기억시킨다
function grantShare(req, res, shareToken) {
  if (!shareToken || res.headersSent) return
  const cur = verify(readCookies(req)[SHARE_COOKIE])
  const tokens = [shareToken, ...((cur && Array.isArray(cur.t)) ? cur.t : []).filter((t) => t !== shareToken)].slice(0, MAX_SHARES)
  if (cur && cur.t?.[0] === shareToken && cur.exp - Date.now() / 1000 > RENEW_BEFORE_S) return
  const value = jwt.sign({ t: tokens }, process.env.JWT_SECRET, { audience: AUD, expiresIn: '30d' })
  res.cookie(SHARE_COOKIE, value, cookieOptions(req))
}

function clearCookies(req, res) {
  const { maxAge, ...opts } = cookieOptions(req) // eslint-disable-line no-unused-vars
  res.clearCookie(USER_COOKIE, opts)
  res.clearCookie(SHARE_COOKIE, opts)
}

// 이 요청을 보낸 사람: 로그인 헤더(앱 안 fetch) 또는 악보 쿠키(<img>)
async function viewerOf(req) {
  let user = await optionalUser(req)
  const cookies = readCookies(req)
  if (!user) {
    const c = verify(cookies[USER_COOKIE])
    if (c?.id) {
      user = await User.findById(c.id).select('-password')
      if (user?.mustChangePassword) user = null
    }
  }
  const s = verify(cookies[SHARE_COOKIE])
  return { user, shareTokens: Array.isArray(s?.t) ? s.t.filter((t) => typeof t === 'string').slice(0, MAX_SHARES) : [] }
}

// → 'ok' | 'login'(누군지 모름) | 'forbidden'(권한 없음)
async function canViewFile(req, fileId) {
  const { user, shareTokens } = await viewerOf(req)
  if (!user && !shareTokens.length) return 'login'
  if (isOperator(user)) return 'ok' // 저작권 신고 처리

  const url = `/api/sheets/${fileId}`
  if (user && await SheetFile.exists({ fileId, uploadedBy: user._id })) return 'ok'
  const songs = await Song.find({ $or: [{ 'sheets.pages.url': url }, { sheetImageUrl: url }, { sheetPdfUrl: url }] }, '_id').lean()
  if (!songs.length) return user ? 'forbidden' : 'login'
  const songIds = songs.map((s) => s._id)

  if (user && await Song.exists({ _id: { $in: songIds }, ...(await accessFilter(user)) })) return 'ok'
  // 공유 링크로 본 사람: 그 콘티에 이 곡이 있고, 링크가 지금도 팀 밖 사람에게 열려 있어야 한다(열린 링크 또는 공유 비밀번호)
  if (shareTokens.length && await Setlist.exists({
    shareToken: { $in: shareTokens },
    songs: { $in: songIds },
    $or: [{ shareOpen: { $ne: false } }, { sharePinHash: { $nin: [null, ''] } }],
  })) return 'ok'
  return user ? 'forbidden' : 'login'
}

module.exports = { ensureUserCookie, grantShare, clearCookies, canViewFile }
