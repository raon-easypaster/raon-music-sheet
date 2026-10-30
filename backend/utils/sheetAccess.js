const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const Song = require('../models/Song')
const Setlist = require('../models/Setlist')
const SheetFile = require('../models/SheetFile')
const User = require('../models/User')
const Team = require('../models/Team')
const optionalUser = require('./optionalUser')
const { accessFilter } = require('./access')
const { isOperator } = require('./operator')

// 앱에 올린 악보 파일(/api/sheets/:fileId)은 볼 권한이 있는 사람에게만 보낸다.
// <img>·PDF 보기는 로그인 헤더를 붙일 수 없으므로, 악보 파일 주소에만 쓰는 쿠키 두 개로 확인한다.
// - raon_sv: 로그인한 사람 (로그인 정보가 붙은 요청마다 서버가 새로 맞춰 둔다)
// - raon_ss: 이 기기에서 열어 본 공유 링크 (공유 화면이 열릴 때마다 더한다, 최근 20개)
//   링크마다 그때의 열림 상태·공유 비밀번호를 요약한 값을 함께 담아, 비밀번호를 바꾸거나 링크를 잠그면 예전 쿠키는 더 이상 통하지 않는다
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

// 공유 링크의 지금 접근 상태(열림 여부·공유 비밀번호) 요약. 둘 중 하나라도 바뀌면 값이 달라진다
const shareVersion = (setlist) =>
  crypto.createHash('sha256').update(`${setlist.shareOpen === false ? 0 : 1}|${setlist.sharePinHash || ''}`).digest('hex').slice(0, 12)

const grantsOf = (cookie) => (Array.isArray(cookie?.g) ? cookie.g : [])
  .filter((g) => Array.isArray(g) && typeof g[0] === 'string' && typeof g[1] === 'string')
  .slice(0, MAX_SHARES)

// 공유 화면을 연 기기에 그 공유 링크(와 지금의 접근 상태)를 기억시킨다
function grantShare(req, res, setlist) {
  if (!setlist?.shareToken || res.headersSent) return
  const entry = [setlist.shareToken, shareVersion(setlist)]
  const cur = verify(readCookies(req)[SHARE_COOKIE])
  const old = grantsOf(cur)
  if (old[0]?.[0] === entry[0] && old[0]?.[1] === entry[1] && cur.exp - Date.now() / 1000 > RENEW_BEFORE_S) return
  const grants = [entry, ...old.filter((g) => g[0] !== entry[0])].slice(0, MAX_SHARES)
  const value = jwt.sign({ g: grants }, process.env.JWT_SECRET, { audience: AUD, expiresIn: '30d' })
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
  return { user, grants: grantsOf(verify(cookies[SHARE_COOKIE])) }
}

// → 'ok' | 'login'(누군지 모름) | 'forbidden'(권한 없음)
async function canViewFile(req, fileId) {
  const { user, grants } = await viewerOf(req)
  if (!user && !grants.length) return 'login'
  if (isOperator(user)) return 'ok' // 저작권 신고 처리

  const url = `/api/sheets/${fileId}`
  if (user && await SheetFile.exists({ fileId, uploadedBy: user._id })) return 'ok'
  const songs = await Song.find({ $or: [{ 'sheets.pages.url': url }, { sheetImageUrl: url }, { sheetPdfUrl: url }] }, '_id').lean()
  if (!songs.length) return user ? 'forbidden' : 'login'
  const songIds = songs.map((s) => s._id)

  if (user && await Song.exists({ _id: { $in: songIds }, ...(await accessFilter(user)) })) return 'ok'
  // 공유 링크로 본 사람: 그 콘티에 이 곡이 있고, 링크가 지금도 팀 밖 사람에게 열려 있으며(열린 링크 또는 공유 비밀번호),
  // 쿠키를 받은 뒤로 링크를 잠그거나 비밀번호를 바꾸지 않았어야 한다
  if (grants.length) {
    const versions = new Map(grants)
    const lists = await Setlist.find({
      shareToken: { $in: [...versions.keys()] },
      songs: { $in: songIds },
      $or: [{ shareOpen: { $ne: false } }, { sharePinHash: { $nin: [null, ''] } }],
    }, 'shareToken shareOpen sharePinHash').lean()
    if (lists.some((s) => versions.get(s.shareToken) === shareVersion(s))) return 'ok'
  }
  return user ? 'forbidden' : 'login'
}

// 곡에 넣으려는 앱 악보 파일(/api/sheets/…)을 이 사람이 써도 되는지.
// 남의 팀 파일 주소를 내 곡에 넣어 볼 권한을 얻지 못하게 한다 (파일을 보는 권한은 그 파일을 쓰는 곡으로 정하므로)
// - 내가 올린 파일, 같은 팀 사람이 올린 파일(팀 곡일 때), 또는 내가 볼 수 있는 곡에 이미 들어 있는 파일만 된다
// - 누가 올렸는지 기록이 없고 어느 곡에도 없는 예전 파일은 막지 않는다 (주인을 알 수 없음)
const FILE_URL = /^\/api\/sheets\/([A-Za-z0-9_-]{20,100})$/
function fileIdsOf(song) {
  const urls = [song?.sheetImageUrl, song?.sheetPdfUrl, ...((song?.sheets || []).flatMap((s) => (s.pages || []).map((p) => p.url)))]
  return new Set(urls.map((u) => (String(u || '').match(FILE_URL) || [])[1]).filter(Boolean))
}
async function checkFileUse(user, song, before) {
  const had = before ? fileIdsOf(before) : new Set()
  const added = [...fileIdsOf(song)].filter((id) => !had.has(id))
  if (!added.length) return null
  const filter = await accessFilter(user)
  const team = song.team ? await Team.findOne({ _id: song.team, members: user._id }, 'members').lean() : null
  const uploaders = [user._id, ...(team?.members || [])]
  for (const fileId of added) {
    if (await SheetFile.exists({ fileId, uploadedBy: { $in: uploaders } })) continue
    const url = `/api/sheets/${fileId}`
    const ref = { $or: [{ 'sheets.pages.url': url }, { sheetImageUrl: url }, { sheetPdfUrl: url }] }
    if (await Song.exists({ $and: [ref, filter] })) continue // 둘 다 $or라서 펼쳐 합치면 하나가 덮인다
    if (!(await SheetFile.exists({ fileId })) && !(await Song.exists(ref))) continue
    return '다른 팀이나 다른 사람이 올린 악보 파일은 넣을 수 없습니다. 악보를 직접 올려 주세요'
  }
  return null
}

module.exports = { ensureUserCookie, grantShare, clearCookies, canViewFile, checkFileUse }
