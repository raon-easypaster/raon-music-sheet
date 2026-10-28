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
