// PDF 악보를 앱 안에서 보여 준다 (pdf.js). 처음 PDF를 열 때만 불러와 첫 화면을 무겁게 하지 않는다.
// 쪽마다 그림으로 바꿔서 사진 악보와 똑같이 필기·인쇄·넘기기를 쓴다.

const RENDER_WIDTH = 1400 // 쪽 그림 가로 픽셀 (확대해도 글씨가 보이는 크기)
const MAX_PAGES = 30

let libPromise = null
function loadLib() {
  if (!libPromise) {
    libPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    }).catch((err) => { libPromise = null; throw err })
  }
  return libPromise
}

// 오프라인 저장 때 PDF 보기 프로그램도 이 기기에 받아 둔다 (서비스 워커가 저장)
export async function warmPdfViewer() {
  const lib = await loadLib()
  await fetch(lib.GlobalWorkerOptions.workerSrc).catch(() => {})
  return lib.GlobalWorkerOptions.workerSrc
}

const isExternal = (url) => {
  try { return new URL(url, window.location.href).origin !== window.location.origin } catch { return true }
}

// 실패 이유를 사람이 읽을 수 있게 → { reason, tip }
export function explainPdfError(err, url) {
  const status = err?.status
  const tipUpload = 'PDF 파일을 내려받아 곡 수정 → 악보 → ‘사진·PDF 올리기’로 직접 올리면 앱 안에서 볼 수 있어요.'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { reason: '인터넷이 끊겨 PDF를 받지 못했습니다.', tip: '인터넷이 될 때 ‘악보 오프라인 저장’을 해 두면 끊겨도 볼 수 있어요.' }
  }
  if (status === 451) return { reason: '저작권자의 요청으로 차단된 악보입니다.', tip: '교회가 사용 권한을 가진 악보(구입한 악보·라이선스 곡)로 바꿔 올려 주세요.' }
  if (status === 404) return { reason: 'PDF 파일을 찾을 수 없습니다 (주소가 바뀌었거나 지워졌을 수 있어요).', tip: tipUpload }
  if (status === 401 || status === 403) return { reason: 'PDF에 접근할 권한이 없습니다 (공유가 꺼져 있거나 로그인이 필요한 주소예요).', tip: tipUpload }
  if (err?.name === 'InvalidPDFException') {
    return { reason: 'PDF 파일이 아니거나 손상된 파일입니다. (구글 드라이브의 ‘미리보기’ 주소는 PDF 파일 자체가 아니에요)', tip: tipUpload }
  }
  if (isExternal(url)) {
    return { reason: '외부 사이트가 다른 앱 안에서 이 PDF를 여는 것을 막고 있습니다 (접근 제한).', tip: `‘새 창에서 열기’로 보거나, ${tipUpload}` }
  }
  return { reason: 'PDF를 여는 중 문제가 생겼습니다.', tip: tipUpload }
}

const docs = new Map() // 주소 → 문서 (최근 6개)
async function openDoc(url) {
  if (!docs.has(url)) {
    const p = loadLib().then((lib) => lib.getDocument({ url, isEvalSupported: false, disableRange: true, disableStream: true }).promise)
    p.catch(() => docs.delete(url))
    docs.set(url, p)
    if (docs.size > 6) {
      const [oldest] = docs.keys()
      docs.get(oldest).then((d) => d.destroy()).catch(() => {})
      docs.delete(oldest)
    }
  }
  return docs.get(url)
}

const rendered = new Map() // '주소#쪽' → 그림 주소(blob:)
async function renderPage(doc, url, n) {
  const key = `${url}#${n}`
  if (!rendered.has(key)) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    rendered.set(key, URL.createObjectURL(blob))
  }
  return { page: n, src: rendered.get(key) }
}

// PDF의 모든 쪽을 그림 주소로 → { pages: [{ page: 1, src }, ...], total }
// onProgress가 있으면 쪽 수를 알자마자, 그리고 한 쪽을 그릴 때마다 알려 준다 (첫 쪽을 먼저 보여 주려고)
export async function renderPdfPages(url, onProgress) {
  const doc = await openDoc(url)
  const total = Math.min(doc.numPages, MAX_PAGES)
  const pages = []
  onProgress?.({ total, pages: [] })
  for (let n = 1; n <= total; n++) {
    pages.push(await renderPage(doc, url, n))
    onProgress?.({ total, pages: [...pages] })
  }
  return { pages, total, truncated: doc.numPages > MAX_PAGES }
}
