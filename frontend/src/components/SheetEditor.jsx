import { useEffect, useRef, useState } from 'react'
import { uploadSheetFile } from '../utils/sheetUpload'
import { newSheetId, sheetName } from '../utils/sheets'
import { assetUrl } from '../api/client'
import SheetRightsDialog from './SheetRightsDialog'
import { hasAgreedSheetRights } from '../utils/sheetRights'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

const guessType = (url) => (/\.pdf($|[?#])/i.test(url) ? 'pdf' : 'image')

// 곡의 악보 편집: Key별로 여러 악보, 한 악보에 사진 여러 장 또는 PDF
// - '새 악보 추가'는 다른 Key·다른 판 악보를 하나 더 만드는 것
// - '페이지 추가'는 지금 악보에 쪽을 붙이는 것, '교체'는 그 쪽을 새 파일로 바꾸는 것 (그 쪽의 필기는 새 파일에 따라가지 않는다)
export default function SheetEditor({ value, onChange, title, team }) {
  const sheets = value || []
  const [status, setStatus] = useState({}) // 악보 id → 안내 문구
  const [busy, setBusy] = useState(null)   // 올리는 중인 악보 id
  const [urlForm, setUrlForm] = useState(null) // { sheetId, url, type }
  const fileRef = useRef(null)
  const target = useRef(null) // { sheetId, replacePageId? }
  // '사용 권한이 있는 악보만 올립니다' 동의. 미리 물어 두어야 파일 고르기 창이 바로 열린다
  const [agreed, setAgreed] = useState(false)
  const [askRights, setAskRights] = useState(null) // 동의하면 이어서 할 일
  useEffect(() => {
    let alive = true
    hasAgreedSheetRights().then((ok) => { if (alive) setAgreed(ok) })
    return () => { alive = false }
  }, [])
  const withRights = (fn) => (agreed ? fn() : setAskRights(() => fn))

  const update = (sheetId, fn) => onChange(sheets.map((s) => (s.id === sheetId ? fn(s) : s)))
  const say = (sheetId, text) => setStatus((m) => ({ ...m, [sheetId]: text }))

  function addSheet() {
    onChange([...sheets, { id: newSheetId(), key: '', label: '', pages: [] }])
  }

  function removeSheet(sheet) {
    if (sheet.pages.length && !window.confirm(`‘${sheetName(sheet)}’을(를) 지울까요?\n이 악보를 고른 콘티는 다른 악보를 자동으로 쓰게 됩니다.`)) return
    onChange(sheets.filter((s) => s.id !== sheet.id))
  }

  function pickFiles(sheetId, replacePageId) {
    withRights(() => {
      target.current = { sheetId, replacePageId }
      fileRef.current.multiple = !replacePageId
      fileRef.current.click()
    })
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const { sheetId, replacePageId } = target.current || {}
    if (!files.length || !sheetId) return
    setBusy(sheetId)
    say(sheetId, `${files.length}개 파일을 올리는 중…`)
    const added = []
    const errors = []
    for (const file of files) {
      try {
        const { url, type } = await uploadSheetFile(file, title, team)
        added.push({ id: newSheetId(), type, url })
      } catch (err) {
        if (err.data?.needAgreement) setAgreed(false)
        errors.push(`${file.name}: ${err.message}`)
      }
    }
    if (added.length) {
      update(sheetId, (s) => ({
        ...s,
        pages: replacePageId
          ? s.pages.map((p) => (p.id === replacePageId ? added[0] : p))
          : [...s.pages, ...added],
      }))
    }
    say(sheetId, [
      added.length && `✓ ${added.length}개를 ${replacePageId ? '교체했습니다' : '추가했습니다'}. 곡을 저장하면 반영됩니다.`,
      ...errors,
    ].filter(Boolean).join(' / '))
    setBusy(null)
  }

  function movePage(sheetId, idx, dir) {
    update(sheetId, (s) => {
      const pages = [...s.pages]
      const to = idx + dir
      if (to < 0 || to >= pages.length) return s
      ;[pages[idx], pages[to]] = [pages[to], pages[idx]]
      return { ...s, pages }
    })
  }

  function removePage(sheetId, page) {
    if (!window.confirm('이 쪽을 악보에서 뺄까요? (이 쪽에 그린 필기는 더 이상 보이지 않습니다)')) return
    update(sheetId, (s) => ({ ...s, pages: s.pages.filter((p) => p.id !== page.id) }))
  }

  function addUrl() {
    const url = urlForm.url.trim()
    if (!/^https?:\/\//i.test(url)) { say(urlForm.sheetId, 'https:// 로 시작하는 주소를 넣어 주세요'); return }
    update(urlForm.sheetId, (s) => ({ ...s, pages: [...s.pages, { id: newSheetId(), type: urlForm.type, url }] }))
    say(urlForm.sheetId, '✓ 주소를 추가했습니다. 곡을 저장하면 반영됩니다.')
    setUrlForm(null)
  }

  return (
    <div className="sheet-editor">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={handleFiles} />
      <p className="sheet-editor-help">
        악보는 <b>Key별로 여러 개</b> 넣을 수 있어요. 콘티에서 Key를 고르면 그 Key 악보를 먼저 씁니다.
        한 악보에 사진 여러 장이나 PDF를 넣으면 순서대로 넘겨 봅니다. 교회가 사용 권한을 가진 악보만 올려 주세요.
      </p>

      {sheets.map((sheet, si) => (
        <div key={sheet.id} className="sheet-card">
          <div className="sheet-card-head">
            <b>악보 {si + 1}</b>
            <label>
              악보에 적힌 Key
              <select value={sheet.key} onChange={(e) => update(sheet.id, (s) => ({ ...s, key: e.target.value }))}>
                <option value="">미확인</option>
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <input type="text" placeholder="이름 (선택, 예: 남자키)" maxLength={30} value={sheet.label}
              onChange={(e) => update(sheet.id, (s) => ({ ...s, label: e.target.value }))} />
            <button type="button" className="secondary" onClick={() => removeSheet(sheet)}>악보 지우기</button>
          </div>

          {sheet.pages.length === 0 ? (
            <p className="muted sheet-empty-note">아직 쪽이 없습니다. 사진·PDF를 올리거나 주소를 넣어 주세요.</p>
          ) : (
            <ol className="sheet-pages">
              {sheet.pages.map((page, pi) => (
                <li key={page.id}>
                  {page.type === 'image'
                    ? <img src={assetUrl(page.url)} alt="" className="sheet-thumb" />
                    : <span className="sheet-thumb sheet-thumb-pdf">PDF</span>}
                  <span className="sheet-page-info">
                    <b>{pi + 1}쪽</b> {page.type === 'pdf' ? 'PDF (안의 쪽을 모두 넘겨 봄)' : '사진'}
                    <small>{page.url.startsWith('/api/') ? '앱에 올린 파일' : page.url}</small>
                  </span>
                  <span className="sheet-page-actions">
                    <button type="button" className="secondary" onClick={() => movePage(sheet.id, pi, -1)} disabled={pi === 0} aria-label="앞으로">▲</button>
                    <button type="button" className="secondary" onClick={() => movePage(sheet.id, pi, 1)} disabled={pi === sheet.pages.length - 1} aria-label="뒤로">▼</button>
                    <button type="button" className="secondary" onClick={() => pickFiles(sheet.id, page.id)} disabled={busy === sheet.id}
                      title="이 쪽을 새 파일로 바꿉니다 (이 쪽의 필기는 새 파일에 보이지 않음)">교체</button>
                    <button type="button" className="secondary" onClick={() => removePage(sheet.id, page)}>빼기</button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="sheet-card-actions">
            <button type="button" className="secondary" onClick={() => pickFiles(sheet.id)} disabled={busy === sheet.id}>
              {busy === sheet.id ? '올리는 중…' : '📷 사진·PDF 올리기 (쪽 추가)'}
            </button>
            <button type="button" className="secondary" onClick={() => withRights(() => setUrlForm({ sheetId: sheet.id, url: '', type: 'image' }))}>🔗 주소로 쪽 추가</button>
          </div>
          {urlForm?.sheetId === sheet.id && (
            <div className="sheet-url-form">
              <input type="url" placeholder="https://… (사진 또는 PDF 주소)" value={urlForm.url} autoFocus
                onChange={(e) => setUrlForm((f) => ({ ...f, url: e.target.value, type: guessType(e.target.value) }))} />
              <select value={urlForm.type} onChange={(e) => setUrlForm((f) => ({ ...f, type: e.target.value }))} aria-label="주소 종류">
                <option value="image">사진</option>
                <option value="pdf">PDF</option>
              </select>
              <button type="button" onClick={addUrl}>추가</button>
              <button type="button" className="secondary" onClick={() => setUrlForm(null)}>취소</button>
            </div>
          )}
          {status[sheet.id] && <p className="sheet-status">{status[sheet.id]}</p>}
        </div>
      ))}

      <button type="button" className="secondary sheet-add" onClick={addSheet}>+ 새 악보 추가 (다른 Key·다른 판)</button>
      {askRights && (
        <SheetRightsDialog
          onCancel={() => setAskRights(null)}
          onAgree={() => { setAgreed(true); const next = askRights; setAskRights(null); next() }}
        />
      )}
    </div>
  )
}
