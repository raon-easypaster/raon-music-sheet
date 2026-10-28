/* RAON music sheet 서비스 워커
 * - 화면(앱 껍데기)을 저장해 두어 인터넷이 끊겨도 앱이 열리게 한다
 * - 악보 사진(/api/sheets/:id, 구글 사진)은 한 번 받으면 저장해 두고 다시 쓴다
 * - 공유 콘티(/api/setlists/public/:token)는 마지막으로 받은 내용을 저장해 둔다
 * - 그 밖의 /api 응답(로그인 정보, 곡 목록 등)은 절대 저장하지 않는다
 * 화면 저장 방식을 바꾸면 SHELL_CACHE 번호를, 악보 저장 방식을 바꾸면 SHEET_CACHE 번호를 올린다.
 */
const SHELL_CACHE = 'raon-shell-v1'
const SHEET_CACHE = 'raon-sheets-v1'
const DATA_CACHE = 'raon-data-v1'
const CURRENT_CACHES = [SHELL_CACHE, SHEET_CACHE, DATA_CACHE]

const MAX_SHEETS = 400 // 악보 사진은 이 개수까지만 보관 (오래된 것부터 지움)
const MAX_DATA = 30 // 공유 콘티는 이 개수까지만 보관

const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

const PUBLIC_SETLIST_RE = /^\/api\/setlists\/public\/[^/]+$/
const SHEET_RE = /^\/api\/sheets\/[^/]+$/

// 구글에 올려 둔 악보 사진 주소인지
function isGoogleImageHost(hostname) {
  return (
    hostname.endsWith('.googleusercontent.com') ||
    hostname === 'drive.google.com' ||
    hostname === 'docs.google.com' ||
    hostname === 'lh3.google.com'
  )
}

// 저장해도 되는 악보 사진 주소인지 (미리 저장 요청에도 같은 기준을 쓴다)
function isSheetUrl(url) {
  if (url.origin === self.location.origin) return SHEET_RE.test(url.pathname)
  return url.protocol === 'https:' && isGoogleImageHost(url.hostname)
}

// ── 설치 / 활성화 ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {}) // 일부 파일을 못 받아도 설치는 계속한다
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('raon-') && !CURRENT_CACHES.includes(k))
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

// ── 저장 도우미 ──────────────────────────────────────
async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  // keys()는 넣은 순서대로 나오므로 앞쪽(오래된 것)부터 지운다
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

// 정상 응답이거나, 구글 사진처럼 내용을 볼 수 없는(opaque) 응답이면 저장 가능
function isStorable(response, allowOpaque) {
  if (!response) return false
  if (response.type === 'opaque') return allowOpaque
  return response.ok
}

// 악보: 저장된 게 있으면 바로 쓰고, 없을 때만 받아 온다 (악보 사진은 바뀌지 않는다)
async function sheetCacheFirst(request) {
  const cache = await caches.open(SHEET_CACHE)
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (isStorable(response, true)) {
    await cache.put(request.url, response.clone())
    trimCache(SHEET_CACHE, MAX_SHEETS)
  }
  return response
}

// 공유 콘티: 인터넷이 되면 새로 받고, 안 되면 마지막 저장본을 보여 준다
async function dataNetworkFirst(request) {
  const cache = await caches.open(DATA_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request.url, response.clone())
      trimCache(DATA_CACHE, MAX_DATA)
    }
    return response
  } catch (err) {
    const cached = await cache.match(request.url, { ignoreVary: true })
    if (cached) return cached
    throw err
  }
}

// 화면 이동(주소 열기): 인터넷 우선, 끊기면 저장된 index.html
async function navigationNetworkFirst(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    const type = response.headers.get('content-type') || ''
    if (response.ok && response.type === 'basic' && type.includes('text/html')) {
      // 모든 주소가 같은 index.html이므로 한 곳에만 저장한다
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch (err) {
    const cached = (await cache.match('/index.html')) || (await cache.match('/'))
    if (cached) return cached
    throw err
  }
}

// 빌드된 JS/CSS·아이콘: 저장본을 바로 주고, 뒤에서 새 파일로 바꿔 둔다
async function staleWhileRevalidate(event) {
  const { request } = event
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const update = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  if (cached) {
    event.waitUntil(update)
    return cached
  }
  const response = await update
  return response || Response.error()
}

// ── 요청 가로채기 ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const hasAuth = request.headers.has('authorization')

  // 악보 사진 (로그인 정보가 있어도 저장: 사진은 누구에게나 같은 내용)
  if (url.origin === self.location.origin && SHEET_RE.test(url.pathname)) {
    event.respondWith(sheetCacheFirst(request))
    return
  }
  if (url.origin !== self.location.origin) {
    if (request.destination === 'image' && isSheetUrl(url)) {
      event.respondWith(sheetCacheFirst(request))
    }
    return // 그 밖의 다른 사이트 요청은 건드리지 않는다
  }

  if (url.pathname.startsWith('/api/')) {
    // 공유 콘티만 예외로 저장. 로그인 정보가 붙은 요청은 저장하지 않는다
    if (!hasAuth && PUBLIC_SETLIST_RE.test(url.pathname)) {
      event.respondWith(dataNetworkFirst(request))
    }
    return
  }

  if (hasAuth) return

  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(request))
    return
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(event))
  }
})

// ── 화면에서 보낸 "악보 미리 저장" 요청 ─────────────────
// { type: 'PRECACHE_SHEETS', urls: [...] } → { type: 'PRECACHE_SHEETS_DONE', saved, skipped, failed }
async function precacheSheets(urls) {
  const cache = await caches.open(SHEET_CACHE)
  const result = { saved: 0, skipped: 0, failed: 0 }
  const list = Array.isArray(urls) ? urls.slice(0, MAX_SHEETS) : []
  for (const raw of list) {
    let url
    try { url = new URL(raw, self.location.origin) } catch { result.failed++; continue }
    if (!isSheetUrl(url)) { result.failed++; continue }
    if (await cache.match(url.href, { ignoreVary: true })) { result.skipped++; continue }
    try {
      const sameOrigin = url.origin === self.location.origin
      // 구글 사진은 내용을 읽을 수 없는 방식(no-cors)으로만 받을 수 있다
      const response = await fetch(url.href, sameOrigin ? {} : { mode: 'no-cors' })
      if (isStorable(response, !sameOrigin)) {
        await cache.put(url.href, response)
        result.saved++
      } else {
        result.failed++
      }
    } catch {
      result.failed++
    }
  }
  await trimCache(SHEET_CACHE, MAX_SHEETS)
  return result
}

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type !== 'PRECACHE_SHEETS') return
  const reply = (msg) => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(msg)
    else if (event.source) event.source.postMessage(msg)
  }
  event.waitUntil(
    precacheSheets(data.urls)
      .then((r) => reply({ type: 'PRECACHE_SHEETS_DONE', ...r }))
      .catch(() => reply({ type: 'PRECACHE_SHEETS_DONE', saved: 0, skipped: 0, failed: -1 })),
  )
})
