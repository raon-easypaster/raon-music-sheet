// 오프라인(인터넷 없이) 쓰기 위한 도우미. 실제 저장은 public/sw.js가 한다.

// 서비스 워커를 등록한다 (배포된 화면에서만 부른다)
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register)
}

// 악보 사진 주소 목록을 미리 받아 저장해 둔다 ("이번 주 콘티 악보 미리 저장")
// 결과: { saved, skipped, failed } — saved: 새로 저장, skipped: 이미 저장됨, failed: 실패
// 서비스 워커가 없으면(개발 화면, 오래된 브라우저) { supported: false }를 돌려준다
export async function precacheSheets(urls, { timeoutMs = 60000 } = {}) {
  const list = (urls || []).filter(Boolean)
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { supported: false, saved: 0, skipped: 0, failed: list.length }
  }
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(() => resolve(null), 3000)),
  ])
  const worker = navigator.serviceWorker.controller || reg?.active
  if (!worker) return { supported: false, saved: 0, skipped: 0, failed: list.length }
  if (list.length === 0) return { supported: true, saved: 0, skipped: 0, failed: 0 }

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => {
      resolve({ supported: true, saved: 0, skipped: 0, failed: list.length, timedOut: true })
    }, timeoutMs)
    channel.port1.onmessage = (e) => {
      clearTimeout(timer)
      const { saved = 0, skipped = 0, failed = 0 } = e.data || {}
      resolve({ supported: true, saved, skipped, failed })
    }
    worker.postMessage({ type: 'PRECACHE_SHEETS', urls: list }, [channel.port2])
  })
}

// ── 콘티 오프라인 저장 상태 (이 기기 기준) ──
// 저장 버튼을 눌렀다는 사실이 아니라, 필요한 악보가 실제로 이 기기 저장소에 있는지 직접 확인한다.
// 이름은 public/sw.js의 SHEET_CACHE·DATA_CACHE와 같아야 한다
const SHEET_CACHE = 'raon-sheets-v1'
const DATA_CACHE = 'raon-data-v1'
const recordKey = (setlistId) => `offlineSave:${setlistId}`

const absolute = (url) => { try { return new URL(url, window.location.href).href } catch { return '' } }
const isSameOrigin = (url) => { try { return new URL(url).origin === window.location.origin } catch { return false } }

export function loadOfflineRecord(setlistId) {
  try { return JSON.parse(localStorage.getItem(recordKey(setlistId)) || 'null') } catch { return null }
}
function saveOfflineRecord(setlistId, record) {
  try { localStorage.setItem(recordKey(setlistId), JSON.stringify(record)) } catch { /* 기록을 못 남겨도 저장 여부는 다시 확인할 수 있다 */ }
}

// plan: [{ songId, title, urls: [절대 주소], blocked: [이유] }] — 곡마다 꼭 있어야 할 악보 파일
// signature: 콘티 판 번호 + 악보 주소 (바뀌면 '다시 저장 필요')
export function offlineSignature(revision, plan) {
  return `${revision}|${plan.map((p) => `${p.songId}:${p.urls.join(',')}`).join(';')}`
}

async function cachedSet(urls, dataUrl) {
  if (typeof caches === 'undefined') return { supported: false, have: new Set(), dataSaved: false }
  const sheets = await caches.open(SHEET_CACHE)
  const have = new Set()
  await Promise.all(urls.map(async (u) => { if (await sheets.match(u, { ignoreVary: true })) have.add(u) }))
  let dataSaved = false
  if (dataUrl) dataSaved = !!(await (await caches.open(DATA_CACHE)).match(dataUrl, { ignoreVary: true }))
  return { supported: true, have, dataSaved }
}

// → { state, savedSongs, totalSongs, missing: [제목], blocked: [{ title, reason }], dataSaved, at }
// state: unsupported | none | complete | partial | failed | stale
export async function checkOffline({ setlistId, plan, signature, dataUrl }) {
  const swReady = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller
  const record = loadOfflineRecord(setlistId)
  const withSheets = plan.filter((p) => p.urls.length || p.blocked.length)
  const urls = withSheets.flatMap((p) => p.urls)
  const { supported, have, dataSaved } = await cachedSet(urls, dataUrl)
  const blocked = withSheets.filter((p) => p.blocked.length).map((p) => ({ title: p.title, reason: p.blocked[0] }))
  const savedList = withSheets.filter((p) => !p.blocked.length && p.urls.every((u) => have.has(u)))
  const missing = withSheets.filter((p) => !savedList.includes(p)).map((p) => p.title)
  const base = { savedSongs: savedList.length, totalSongs: withSheets.length, missing, blocked, dataSaved, at: record?.at || null, swReady }
  if (!supported || !swReady) return { ...base, state: 'unsupported' }
  if (!withSheets.length) return { ...base, state: 'nothing' }
  if (record && record.signature !== signature && record.at) return { ...base, state: 'stale' }
  if (savedList.length === withSheets.length) return { ...base, state: 'complete' }
  if (savedList.length === 0) return { ...base, state: record?.failed ? 'failed' : 'none' }
  return { ...base, state: 'partial' }
}

// 저장하고 실제로 저장됐는지 다시 확인한다
export async function saveOffline({ setlistId, plan, signature, dataUrl, pin, warmPdf }) {
  const urls = plan.flatMap((p) => p.urls)
  if (warmPdf) await warmPdf().catch(() => {})
  // 공유 화면 내용(곡 순서·Key)도 받아 둔다. 비밀번호가 걸린 콘티는 공유 화면을 이 기기에서 한 번 열어야 저장된다
  if (dataUrl) {
    await fetch(dataUrl, { headers: pin ? { 'x-share-pin': pin } : {} }).catch(() => {})
  }
  const r = await precacheSheets(urls)
  const status = await checkOffline({ setlistId, plan, signature: 'pending', dataUrl })
  const complete = status.savedSongs === status.totalSongs && !status.blocked.length
  saveOfflineRecord(setlistId, { at: new Date().toISOString(), signature, failed: status.savedSongs === 0 })
  return { ...(await checkOffline({ setlistId, plan, signature, dataUrl })), timedOut: r.timedOut, complete }
}

export const sheetCacheUrl = (url) => (isSameOrigin(absolute(url)) || /^https:/.test(absolute(url)) ? absolute(url) : '')
