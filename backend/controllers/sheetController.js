// 악보 사진을 구글 드라이브 폴더에 올리고, 올린 사진을 다시 보여 준다.
// 드라이브와의 연결은 목사님 구글 계정으로 배포한 Apps Script(docs/drive-upload.gs)가 맡는다.
//   DRIVE_UPLOAD_URL    : Apps Script 웹 앱 주소 (https://script.google.com/macros/s/.../exec)
//   DRIVE_UPLOAD_SECRET : Apps Script에도 똑같이 넣어 둔 비밀 값

// Vercel 요청 크기 한도(4.5MB) 안쪽. base64로 보내면 1.33배가 되므로 PDF는 3MB까지만 받는다
const BlockedSheet = require('../models/BlockedSheet')
const User = require('../models/User')
const SheetFile = require('../models/SheetFile')
const { canViewFile, clearCookies } = require('../utils/sheetAccess')
const MAX_BYTES = { image: 4 * 1024 * 1024, pdf: 3 * 1024 * 1024 }
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_TYPES = [...IMAGE_TYPES, 'application/pdf']

// 파일 이름·형식 이름은 속일 수 있으므로 내용의 첫 몇 바이트로 실제 형식을 확인한다
function sniffType(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return ''
}
const FILE_ID = /^[A-Za-z0-9_-]{20,100}$/

function driveConfig() {
  // 복사·붙여넣기 때 딸려 온 앞뒤 공백·줄바꿈은 무시한다
  const url = (process.env.DRIVE_UPLOAD_URL || '').trim()
  const secret = (process.env.DRIVE_UPLOAD_SECRET || '').trim()
  return url && secret ? { url, secret } : null
}

async function callScript(cfg, payload) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, secret: cfg.secret }),
    redirect: 'follow',
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('구글 드라이브 연결 응답을 읽지 못했습니다') }
  if (!res.ok || data.error) throw new Error(data.error || `구글 드라이브 오류 (${res.status})`)
  return data
}

// POST /api/sheets  { name, mimeType, data(base64) } → { url, type }
// 악보 올리기 동의 안내문 판 번호. 안내문을 크게 바꾸면 올려서 모두에게 다시 묻는다 (화면 SheetRightsDialog와 같이)
const SHEET_RIGHTS_VERSION = 1
const hasAgreed = (user) => (user?.sheetRightsVersion || 0) >= SHEET_RIGHTS_VERSION

// GET /sheets/agreement → { agreed, agreedAt, version }
exports.getAgreement = (req, res) => {
  res.json({ agreed: hasAgreed(req.user), agreedAt: req.user.sheetRightsAgreedAt, version: SHEET_RIGHTS_VERSION })
}

// POST /sheets/agreement  { version } — 화면에서 안내문을 읽고 체크한 뒤에만 부른다
exports.agree = async (req, res) => {
  try {
    if (Number(req.body?.version) !== SHEET_RIGHTS_VERSION) {
      return res.status(400).json({ message: '안내문이 바뀌었습니다. 화면을 새로 고친 뒤 다시 확인해 주세요' })
    }
    const at = new Date()
    await User.updateOne({ _id: req.user._id }, { sheetRightsAgreedAt: at, sheetRightsVersion: SHEET_RIGHTS_VERSION })
    res.json({ agreed: true, agreedAt: at, version: SHEET_RIGHTS_VERSION })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.uploadSheet = async (req, res) => {
  try {
    if (!hasAgreed(req.user)) {
      return res.status(403).json({ message: '악보를 올리기 전에 ‘사용 권한이 있는 악보만 올립니다’에 동의해 주세요', needAgreement: true, version: SHEET_RIGHTS_VERSION })
    }
    const cfg = driveConfig()
    if (!cfg) return res.status(503).json({ message: '악보 파일 올리기가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요. 그동안은 악보 주소(https://…)를 넣어 쓸 수 있습니다' })

    const { name, mimeType, data } = req.body || {}
    if (!ALLOWED_TYPES.includes(mimeType)) return res.status(400).json({ message: 'JPG·PNG·WEBP 사진이나 PDF만 올릴 수 있습니다' })
    if (typeof data !== 'string' || !data) return res.status(400).json({ message: '파일이 비어 있습니다' })
    const isPdf = mimeType === 'application/pdf'
    const limit = isPdf ? MAX_BYTES.pdf : MAX_BYTES.image
    if (Buffer.byteLength(data, 'base64') > limit) {
      return res.status(413).json({
        message: isPdf
          ? 'PDF가 너무 큽니다 (3MB 이하). 페이지를 나눠 올리거나, 사진으로 올리거나, PDF 주소를 넣어 주세요'
          : '사진이 너무 큽니다 (4MB 이하)',
      })
    }
    const actual = sniffType(Buffer.from(data.slice(0, 64), 'base64'))
    if (!actual || (isPdf ? actual !== 'application/pdf' : !IMAGE_TYPES.includes(actual))) {
      return res.status(400).json({ message: '파일 내용이 사진이나 PDF가 아닙니다. 파일이 손상되지 않았는지 확인해 주세요' })
    }

    const safeName = String(name || 'sheet').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
    let result
    try {
      result = await callScript(cfg, {
        action: 'upload',
        name: `${new Date().toISOString().slice(0, 10)}_${safeName}`,
        mimeType: actual,
        data,
        uploader: req.user.email,
      })
    } catch (err) {
      // 드라이브 연결 스크립트를 PDF를 받도록 아직 고치지 않은 경우
      if (isPdf && /사진 파일만/.test(err.message)) {
        throw new Error('구글 드라이브 연결이 아직 PDF를 받지 않습니다. 관리자가 연결 스크립트(docs/drive-upload.gs)를 새 판으로 바꿔야 합니다. 그동안은 PDF 주소를 넣거나 사진으로 올려 주세요')
      }
      throw err
    }
    if (!FILE_ID.test(result.id || '')) throw new Error('구글 드라이브가 올바른 파일 번호를 돌려주지 않았습니다')

    // 곡에 저장하기 전에도 올린 사람은 미리보기를 볼 수 있게 기록한다
    await SheetFile.updateOne({ fileId: result.id }, { $setOnInsert: { fileId: result.id, uploadedBy: req.user._id } }, { upsert: true })
    res.status(201).json({ url: `/api/sheets/${result.id}`, type: isPdf ? 'pdf' : 'image' })
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}

// DELETE /api/sheets/session — 로그아웃할 때 이 기기의 악보 쿠키를 지운다
exports.clearSession = (req, res) => {
  clearCookies(req, res)
  res.json({ ok: true })
}

// GET /api/sheets/:id → 사진·PDF. 볼 권한이 있는 사람에게만 보낸다 (utils/sheetAccess.js)
// - 그 파일을 쓰는 곡의 팀원(개인 곡은 본인), 올린 사람, 그 곡이 든 콘티를 공유 링크로 연 기기, 운영자
exports.getSheet = async (req, res) => {
  try {
    const cfg = driveConfig()
    if (!cfg) return res.status(503).json({ message: '악보 사진 저장소가 설정되지 않았습니다' })
    if (!FILE_ID.test(req.params.id)) return res.status(400).json({ message: '잘못된 사진 주소입니다' })
    // 저작권 신고로 차단한 파일 (451 = 법적 사유로 볼 수 없음). 차단은 바로 보이도록 저장하지 않게 한다
    if (await BlockedSheet.exists({ fileId: req.params.id })) {
      res.set('Cache-Control', 'no-store')
      return res.status(451).json({ message: '저작권자의 요청으로 차단된 악보입니다', blocked: true })
    }
    const access = await canViewFile(req, req.params.id)
    if (access !== 'ok') {
      res.set('Cache-Control', 'no-store')
      return access === 'login'
        ? res.status(401).json({ message: '로그인하거나 공유 링크로 연 사람만 볼 수 있는 악보입니다', needLogin: true })
        : res.status(403).json({ message: '이 악보를 볼 권한이 없습니다' })
    }

    const result = await callScript(cfg, { action: 'get', id: req.params.id })
    if (!ALLOWED_TYPES.includes(result.mimeType)) return res.status(415).json({ message: '악보 파일(사진·PDF)이 아닙니다' })

    res.set('Content-Type', result.mimeType)
    if (result.mimeType === 'application/pdf') res.set('Content-Disposition', 'inline')
    res.set('X-Content-Type-Options', 'nosniff')
    // 볼 권한을 사람마다 확인하므로 CDN(공용 저장소)에는 두지 않고, 이 기기 브라우저에만 1시간 둔다
    // (짧게 두는 것은 저작권 신고로 차단했을 때 빨리 반영하려는 것이기도 하다)
    res.set('Cache-Control', 'private, max-age=3600')
    res.set('X-Robots-Tag', 'noindex')
    res.send(Buffer.from(result.data, 'base64'))
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}
