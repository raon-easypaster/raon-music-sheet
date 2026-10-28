import { useEffect, useState } from 'react'
import './InstallAppButton.css'

// 안드로이드·크롬의 "설치" 신호는 화면이 뜨기 전에 올 수 있어서, 파일을 불러오자마자 받아 둔다
let savedPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // 브라우저 기본 안내 대신 우리 버튼을 보여 준다
    savedPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    savedPrompt = null
    notify()
  })
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// 아이폰·아이패드인지 (아이패드는 맥처럼 보이기도 해서 터치 여부로 함께 본다)
function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

const IOS_HIDE_KEY = 'installGuideHidden'

function loadIosHidden() {
  try { return localStorage.getItem(IOS_HIDE_KEY) === '1' } catch { return false }
}

// "앱으로 설치" 버튼. 설치할 수 없거나 이미 설치된 화면에서는 아무것도 보이지 않는다
export default function InstallAppButton({ className = '' }) {
  const [canPrompt, setCanPrompt] = useState(() => !!savedPrompt)
  const [installed, setInstalled] = useState(isStandalone)
  const [showGuide, setShowGuide] = useState(false)
  const [iosHidden, setIosHidden] = useState(loadIosHidden)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const update = () => {
      setCanPrompt(!!savedPrompt)
      if (!savedPrompt && isStandalone()) setInstalled(true)
    }
    listeners.add(update)
    return () => listeners.delete(update)
  }, [])

  async function handleInstall() {
    const prompt = savedPrompt
    if (!prompt) return
    prompt.prompt()
    try {
      const choice = await prompt.userChoice
      if (choice?.outcome === 'accepted') setDone(true)
    } catch { /* 무시 */ }
    // 설치 창은 한 번만 띄울 수 있다
    savedPrompt = null
    notify()
  }

  function hideIosGuide() {
    setIosHidden(true)
    try { localStorage.setItem(IOS_HIDE_KEY, '1') } catch { /* 무시 */ }
  }

  if (installed) return null

  if (done) {
    return <div className={`install-app ${className}`}><p className="install-app-done">✓ 홈 화면에 설치했어요</p></div>
  }

  // 안드로이드·크롬·엣지
  if (canPrompt) {
    return (
      <div className={`install-app ${className}`}>
        <button type="button" className="install-app-btn" onClick={handleInstall}>
          📲 앱으로 설치
        </button>
      </div>
    )
  }

  // 아이폰·아이패드 사파리: 자동 설치 창이 없어서 방법을 알려 준다
  if (isIOS() && !iosHidden) {
    return (
      <div className={`install-app ${className}`}>
        <button type="button" className="install-app-btn" onClick={() => setShowGuide(s => !s)} aria-expanded={showGuide}>
          📲 앱으로 설치
        </button>
        {showGuide && (
          <div className="install-app-guide" role="note">
            <ol>
              <li>사파리 아래쪽(아이패드는 위쪽)의 <b>공유 버튼</b> <span aria-hidden="true">⬆︎</span> 을 누르세요.</li>
              <li><b>홈 화면에 추가</b>를 누르세요.</li>
              <li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 RAON 아이콘이 생겨요.</li>
            </ol>
            <button type="button" className="install-app-hide" onClick={hideIosGuide}>
              다시 보지 않기
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
