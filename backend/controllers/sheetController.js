// 악보 사진을 구글 드라이브 폴더에 올리고, 올린 사진을 다시 보여 준다.
// 드라이브와의 연결은 목사님 구글 계정으로 배포한 Apps Script(docs/drive-upload.gs)가 맡는다.
//   DRIVE_UPLOAD_URL    : Apps Script 웹 앱 주소 (https://script.google.com/macros/s/.../exec)
//   DRIVE_UPLOAD_SECRET : Apps Script에도 똑같이 넣어 둔 비밀 값

// Vercel 요청 크기 한도(4.5MB) 안쪽. base64로 보내면 1.33배가 되므로 PDF는 3MB까지만 받는다
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
exports.uploadSheet = async (req, res) => {
  try {
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

    res.status(201).json({ url: `/api/sheets/${result.id}`, type: isPdf ? 'pdf' : 'image' })
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}

// GET /api/sheets/:id → 사진·PDF (공유 링크에서도 보이도록 로그인 없이 열린다. 폴더 밖 파일은 Apps Script가 거절)
exports.getSheet = async (req, res) => {
  try {
    const cfg = driveConfig()
    if (!cfg) return res.status(503).json({ message: '악보 사진 저장소가 설정되지 않았습니다' })
    if (!FILE_ID.test(req.params.id)) return res.status(400).json({ message: '잘못된 사진 주소입니다' })

    const result = await callScript(cfg, { action: 'get', id: req.params.id })
    if (!ALLOWED_TYPES.includes(result.mimeType)) return res.status(415).json({ message: '악보 파일(사진·PDF)이 아닙니다' })

    res.set('Content-Type', result.mimeType)
    if (result.mimeType === 'application/pdf') res.set('Content-Disposition', 'inline')
    res.set('X-Content-Type-Options', 'nosniff')
    // 브라우저와 Vercel CDN에 오래 저장해 드라이브 호출을 줄인다 (같은 번호의 파일은 내용이 바뀌지 않는다)
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable')
    res.set('X-Robots-Tag', 'noindex')
    res.send(Buffer.from(result.data, 'base64'))
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}
