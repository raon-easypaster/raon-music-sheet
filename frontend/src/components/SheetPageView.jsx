import { useState } from 'react'
import SheetAnnotator from './SheetAnnotator'
import { keyStateText } from '../utils/sheets'

// 악보 한 쪽: 사진·PDF 쪽을 보여 주고 그 쪽에 필기를 붙인다.
// 열지 못하면 이유와 할 수 있는 방법을 보여 준다
export function SheetPageView({ view, song, shareToken, pin, dark = false, toolbarHost, wrapStyle, imgStyle, imgClassName }) {
  const [failedSrc, setFailedSrc] = useState(null)
  if (!view) return <SheetEmpty title={song?.title} dark={dark} />
  if (view.loading) return <div className={`sheet-msg${dark ? ' is-dark' : ''}`}>PDF 악보를 여는 중…</div>
  if (view.error) return <SheetError dark={dark} reason={view.error.reason} tip={view.error.tip} openUrl={view.openUrl} />
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
        onError={() => setFailedSrc(view.src)} />
    </SheetAnnotator>
  )
}

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
