import { useState } from 'react'
import SheetAnnotator from './SheetAnnotator'
import { keyStateText } from '../utils/sheets'

// 악보 한 쪽: 사진·PDF 쪽을 보여 주고 그 쪽에 필기를 붙인다.
// 열지 못하면 이유와 할 수 있는 방법을 보여 준다
export function SheetPageView({ view, song, shareToken, pin, dark = false, toolbarHost, wrapStyle, imgStyle, imgClassName }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const [blockedSrc, setBlockedSrc] = useState(null) // { src, status }: 차단(451)이나 권한 없음(401·403)으로 못 연 악보
  if (!view) return <SheetEmpty title={song?.title} dark={dark} />
  if (view.loading) return <div className={`sheet-msg${dark ? ' is-dark' : ''}`}>PDF 악보를 여는 중…</div>
  if (view.error) return <SheetError dark={dark} reason={view.error.reason} tip={view.error.tip} openUrl={view.openUrl} />
  if (failedSrc === view.src && blockedSrc?.src === view.src) {
    return blockedSrc.status === 451
      ? <SheetError dark={dark} reason={BLOCKED_REASON} tip={BLOCKED_TIP} />
      : <SheetError dark={dark} reason={NO_ACCESS_REASON} tip={NO_ACCESS_TIP} />
  }
  if (failedSrc === view.src) {
    return (
      <SheetError
        dark={dark}
        reason={navigator.onLine === false
          ? '인터넷이 끊겨 악보를 받지 못했습니다. 이 기기에 저장해 둔 악보가 아닙니다.'
          : '악보 이미지를 불러오지 못했습니다. 주소가 바뀌었거나, 공유가 꺼져 있거나, 외부 사이트가 막고 있을 수 있어요.'}
        tip="‘새 창에서 열기’로 확인하거나, 악보 사진을 내려받아 곡 수정 → 악보에서 직접 올려 주세요."
        openUrl={view.openUrl}
      />
    )
  }
  return (
    <SheetAnnotator key={`${song._id}:${view.pageKey}`} shareToken={shareToken} pin={pin} songId={song._id} page={view.pageKey}
      dark={dark} toolbarHost={toolbarHost} wrapStyle={wrapStyle}>
      <img src={view.src} alt={`${song.title} 악보`} className={imgClassName} style={imgStyle} draggable={false}
        onError={() => {
          const src = view.src
          setFailedSrc(src)
          // 앱에 올린 악보면 왜 못 여는지 서버에 한 번 물어본다 (차단됐는지)
          if (/\/api\/sheets\//.test(src)) {
            fetch(src, { credentials: 'include' }).then((r) => { if ([401, 403, 451].includes(r.status)) setBlockedSrc({ src, status: r.status }) }).catch(() => {})
          }
        }} />
    </SheetAnnotator>
  )
}

const NO_ACCESS_REASON = '이 악보를 볼 권한이 없습니다. 악보는 팀원이나 공유 링크로 연 사람만 볼 수 있어요.'
const NO_ACCESS_TIP = '앱에 팀 계정으로 로그인하거나, 받은 공유 링크를 이 기기에서 다시 열어 주세요.'
const BLOCKED_REASON = '저작권자의 요청으로 차단된 악보입니다.'
const BLOCKED_TIP = '이 악보는 앱에서 더 이상 보여 줄 수 없습니다. 교회가 사용 권한을 가진 악보(구입한 악보·라이선스 곡)로 바꿔 올려 주세요. 문의는 앱의 ‘저작권 신고·문의’로 해 주세요.'

export function SheetEmpty({ title, dark }) {
  return (
    <div className={`sheet-msg${dark ? ' is-dark' : ''}`}>
      <div style={{ fontSize: 34 }}>🎵</div>
      {title && <b>{title}</b>}
      <span>등록된 악보가 없습니다</span>
    </div>
  )
}

export function SheetError({ reason, tip, openUrl, dark }) {
  return (
    <div className={`sheet-msg sheet-msg-error${dark ? ' is-dark' : ''}`} role="alert">
      <b>악보를 열 수 없습니다</b>
      <span>{reason}</span>
      {tip && <span className="sheet-msg-tip">{tip}</span>}
      {openUrl && <a href={openUrl} target="_blank" rel="noopener noreferrer" className="link-btn">새 창에서 열기</a>}
    </div>
  )
}

// 콘티 Key와 악보 Key가 다르거나 확인되지 않았을 때 알림. Key 이름만 바뀐 것이지 악보가 조옮김된 것이 아님을 분명히 한다
export function KeyNotice({ song, dark = false, compact = false }) {
  const text = keyStateText({ keyState: song.keyState, key: song.key, sheet: song.sheet })
  if (!text) return null
  return (
    <div className={`key-notice key-notice-${song.keyState}${dark ? ' is-dark' : ''}`} role="note">
      <b>{song.keyState === 'mismatch' ? '⚠ Key 다름' : '❔ 악보 Key 미확인'}</b> {text}
      {!compact && (
        <span className="key-notice-sub">
          {song.keyState === 'mismatch'
            ? ` 악보 그림은 ${song.sheet.key} 그대로입니다 (자동 조옮김 아님).`
            : ' 악보에 적힌 Key를 확인해 주세요.'}
        </span>
      )}
    </div>
  )
}

// 곡 안의 쪽 넘기기 (곡 넘기기와 따로)
export function PageNav({ index, total, onChange, dark = false }) {
  if (total <= 1) return null
  return (
    <div className={`page-nav${dark ? ' is-dark' : ''}`} role="group" aria-label="악보 쪽 넘기기">
      <button type="button" onClick={() => onChange(index - 1)} disabled={index <= 0}>‹ 이전 쪽</button>
      <span aria-live="polite">{index + 1} / {total}쪽</span>
      <button type="button" onClick={() => onChange(index + 1)} disabled={index >= total - 1}>다음 쪽 ›</button>
    </div>
  )
}
