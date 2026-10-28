import { apiFetch } from '../api/client'

const MAX_SIDE = 2400 // 악보 글씨가 보이면서도 용량이 작은 크기

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다')) }
    img.src = url
  })
}

// 휴대폰 사진은 크기가 커서 그대로 올리면 실패하므로, 긴 변 2400px JPEG로 줄인 뒤 올린다
async function compress(file) {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // 투명 PNG도 흰 바탕으로
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

const MAX_PDF_BYTES = 3 * 1024 * 1024 // 서버 한도와 같다 (Vercel 요청 크기 안쪽)

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1))
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다'))
    reader.readAsDataURL(file)
  })
}

const isPdfFile = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

// 사진 또는 PDF를 올린다 → { url, type: 'image' | 'pdf' }
export async function uploadSheetFile(file, title) {
  if (isPdfFile(file)) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`PDF가 ${(file.size / 1024 / 1024).toFixed(1)}MB라 올릴 수 없습니다 (3MB 이하). 페이지를 나눠 올리거나, 사진으로 올리거나, PDF 주소를 넣어 주세요`)
    }
    const data = await readBase64(file)
    const { url } = await apiFetch('/sheets', {
      method: 'POST',
      body: JSON.stringify({ name: `${title || 'sheet'}.pdf`, mimeType: 'application/pdf', data }),
    })
    return { url, type: 'pdf' }
  }
  if (!file.type.startsWith('image/')) throw new Error('사진(JPG·PNG 등)이나 PDF만 올릴 수 있습니다')
  return { url: await uploadSheetPhoto(file, title), type: 'image' }
}

// 사진을 구글 드라이브 폴더에 올리고, 악보 이미지 칸에 넣을 주소를 돌려준다
export async function uploadSheetPhoto(file, title) {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있습니다')
  const data = await compress(file)
  const { url } = await apiFetch('/sheets', {
    method: 'POST',
    body: JSON.stringify({ name: `${title || 'sheet'}.jpg`, mimeType: 'image/jpeg', data }),
  })
  return url
}
