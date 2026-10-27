// 악보 사진을 구글 드라이브 폴더에 올리고, 올린 사진을 다시 보여 준다.
// 드라이브와의 연결은 목사님 구글 계정으로 배포한 Apps Script(docs/drive-upload.gs)가 맡는다.
//   DRIVE_UPLOAD_URL    : Apps Script 웹 앱 주소 (https://script.google.com/macros/s/.../exec)
//   DRIVE_UPLOAD_SECRET : Apps Script에도 똑같이 넣어 둔 비밀 값

const MAX_BYTES = 4 * 1024 * 1024 // Vercel 요청 크기 한도(4.5MB) 안쪽
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
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

// POST /api/sheets  { name, mimeType, data(base64) } → { url }
exports.uploadSheet = async (req, res) => {
  try {
    const cfg = driveConfig()
    if (!cfg) return res.status(503).json({ message: '악보 사진 올리기가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요' })

    const { name, mimeType, data } = req.body || {}
    if (!ALLOWED_TYPES.includes(mimeType)) return res.status(400).json({ message: 'JPG·PNG·WEBP 사진만 올릴 수 있습니다' })
    if (typeof data !== 'string' || !data) return res.status(400).json({ message: '사진이 비어 있습니다' })
    if (Buffer.byteLength(data, 'base64') > MAX_BYTES) return res.status(413).json({ message: '사진이 너무 큽니다 (4MB 이하)' })

    const safeName = String(name || 'sheet').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
    const result = await callScript(cfg, {
      action: 'upload',
      name: `${new Date().toISOString().slice(0, 10)}_${safeName}`,
      mimeType,
      data,
      uploader: req.user.email,
    })
    if (!FILE_ID.test(result.id || '')) throw new Error('구글 드라이브가 올바른 파일 번호를 돌려주지 않았습니다')

    res.status(201).json({ url: `/api/sheets/${result.id}` })
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}

// GET /api/sheets/:id → 사진 (공유 링크에서도 보이도록 로그인 없이 열린다. 폴더 밖 파일은 Apps Script가 거절)
exports.getSheet = async (req, res) => {
  try {
    const cfg = driveConfig()
    if (!cfg) return res.status(503).json({ message: '악보 사진 저장소가 설정되지 않았습니다' })
    if (!FILE_ID.test(req.params.id)) return res.status(400).json({ message: '잘못된 사진 주소입니다' })

    const result = await callScript(cfg, { action: 'get', id: req.params.id })
    if (!ALLOWED_TYPES.includes(result.mimeType)) return res.status(415).json({ message: '사진 파일이 아닙니다' })

    res.set('Content-Type', result.mimeType)
    // 브라우저와 Vercel CDN에 오래 저장해 드라이브 호출을 줄인다 (같은 번호의 파일은 내용이 바뀌지 않는다)
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable')
    res.set('X-Robots-Tag', 'noindex')
    res.send(Buffer.from(result.data, 'base64'))
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}
