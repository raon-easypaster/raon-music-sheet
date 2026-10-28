import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COPYRIGHT_NOTICE } from '../utils/copyright'
import { formatKoreanDate } from '../utils/dates'
import { KIND_LABEL, formatMinutes } from '../utils/serviceOrder'
import { effectiveSheets, keyStateText } from '../utils/sheets'
import { assetUrl } from '../api/client'
import { renderPdfPages, explainPdfError } from '../utils/pdf'

// 곡마다 '이번 Key로 고른 악보'의 모든 쪽을 인쇄 칸으로 (PDF는 쪽마다 그림으로 바꾼다)
async function buildCells(songs) {
  const cells = []
  for (const [i, s] of songs.entries()) {
    const sheet = s.choice ? s.choice.sheet : effectiveSheets(s)[0]
    const base = { song: s, number: i + 1 }
    if (!sheet) { cells.push({ ...base, key: `${s._id}:none` }); continue }
    const pages = []
    for (const page of sheet.pages) {
      const url = assetUrl(page.url)
      if (page.type === 'image') { pages.push({ key: page.id, src: url }); continue }
      try {
        const r = await renderPdfPages(url)
        r.pages.forEach((pg) => pages.push({ key: `${page.id}#${pg.page}`, src: pg.src }))
      } catch (err) {
        pages.push({ key: `${page.id}#x`, error: explainPdfError(err, url).reason, openUrl: url })
      }
    }
    pages.forEach((pg, k) => cells.push({ ...base, ...pg, key: `${s._id}:${pg.key}`, pageNo: k + 1, pageTotal: pages.length }))
  }
  return cells
}

// 용지별 크기(mm)와 한 장에 넣을 수 있는 악보 수 → [가로 칸, 세로 칸]
const PAPERS = {
  'a4-portrait':     { label: 'A4 세로',     size: 'A4 portrait',     w: 210,   h: 297,   splits: { 1: [1, 1], 2: [2, 1], 4: [2, 2] } },
  'a4-landscape':    { label: 'A4 가로',     size: 'A4 landscape',    w: 297,   h: 210,   splits: { 1: [1, 1], 2: [2, 1], 3: [3, 1] } },
  'letter-portrait': { label: 'Letter 세로', size: 'letter portrait', w: 215.9, h: 279.4, splits: { 1: [1, 1], 2: [2, 1], 4: [2, 2] } },
}
const MM_TO_PX = 96 / 25.4
const PREF_KEY = 'printLayout'

function loadPref() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
    if (PAPERS[p.paper] && PAPERS[p.paper].splits[p.split]) return p
  } catch { /* 저장된 값이 없으면 기본값 */ }
  return { paper: 'a4-portrait', split: 2, showList: true }
}

// order: 예배 순서가 있는 콘티면 [{ kind, title, at, minutes, songData }] (첫 장 순서표에 씀)
export default function PrintView({ setlist, songs, order = null, totalMinutes = 0, onClose }) {
  const [pref, setPref] = useState(loadPref)
  const [scale, setScale] = useState(1)
  const [built, setBuilt] = useState(null) // { forKey, cells }
  const areaRef = useRef(null)
  const songsKey = songs.map((s) => `${s._id}:${(s.choice?.sheet?.pages || []).map((p) => p.url).join(',')}`).join('|')
  const cells = built?.forKey === songsKey ? built.cells : null

  useEffect(() => {
    let alive = true
    buildCells(songs).then((c) => { if (alive) setBuilt({ forKey: songsKey, cells: c }) })
    return () => { alive = false }
  }, [songs, songsKey])
  const paper = PAPERS[pref.paper]
  const [cols, rows] = paper.splits[pref.split]
  const perPage = cols * rows

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)) } catch { /* 이 기기에 기억 못 해도 인쇄는 됨 */ }
  }, [pref])

  // 화면 미리보기는 창 너비에 맞춰 줄인다 (인쇄할 때는 실제 크기)
  useLayoutEffect(() => {
    const fit = () => {
      const width = areaRef.current?.clientWidth || window.innerWidth
      setScale(Math.min(1, (width - 24) / (paper.w * MM_TO_PX)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [paper.w])

  // 인쇄 칸 = 악보 한 쪽 (여러 장 악보는 여러 칸)
  const pages = useMemo(() => {
    const out = []
    const list = cells || []
    for (let i = 0; i < list.length; i += perPage) out.push(list.slice(i, i + perPage))
    return out.length ? out : [[]]
  }, [cells, perPage])

  const title = [setlist.gigDate && formatKoreanDate(setlist.gigDate), setlist.name].filter(Boolean).join(' · ')

  function setOption(patch) {
    setPref((p) => {
      const next = { ...p, ...patch }
      // 용지를 바꿨는데 그 용지에 없는 분할이면 2분할(없으면 1)로
      if (!PAPERS[next.paper].splits[next.split]) next.split = PAPERS[next.paper].splits[2] ? 2 : 1
      return next
    })
  }

  return (
    <div className="print-overlay">
      <style>{`@page { size: ${paper.size}; margin: 0; }`}</style>

      <div className="print-toolbar no-print">
        <strong>🖨 인쇄 / PDF 저장</strong>
        <label>
          용지
          <select value={pref.paper} onChange={(e) => setOption({ paper: e.target.value })}>
            {Object.entries(PAPERS).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
          </select>
        </label>
        <label>
          한 장에
          <select value={pref.split} onChange={(e) => setOption({ split: Number(e.target.value) })}>
            {Object.keys(paper.splits).map((n) => <option key={n} value={n}>{n}쪽</option>)}
          </select>
        </label>
        <label className="print-check">
          <input type="checkbox" checked={pref.showList} onChange={(e) => setOption({ showList: e.target.checked })} />
          첫 장에 {order ? '예배 순서' : '곡 순서'}
        </label>
        <span className="print-actions">
          <button type="button" onClick={() => window.print()} disabled={!cells}>{cells ? '인쇄 / PDF로 저장' : '악보 준비 중…'}</button>
          <button type="button" className="secondary" onClick={onClose}>닫기</button>
        </span>
        <p className="print-hint">
          인쇄 창에서 대상(프린터)을 <b>"PDF로 저장"</b>으로 고르면 PDF 파일로 받을 수 있습니다. 여백은 "없음", 배경 그래픽은 켜 두세요.
        </p>
      </div>

      <div className="print-area" ref={areaRef} style={{ '--preview-scale': scale }}>
        {pages.map((pageSongs, p) => (
          <div
            key={p}
            className="print-page"
            style={{ width: `${paper.w}mm`, height: `${paper.h}mm` }}
          >
            <header className="print-head">
              <span>{title}</span>
              <span>{p + 1} / {pages.length}</span>
            </header>

            {p === 0 && pref.showList && order && (
              <table className="print-service">
                <tbody>
                  {order.map((row) => (
                    <tr key={row.key} className={`kind-${row.kind}`}>
                      <td>{row.at}</td>
                      <td>{KIND_LABEL[row.kind]}</td>
                      <td>
                        {row.songData ? <>{row.songData.title}{row.songData.displayKey && <b> · {row.songData.displayKey}</b>}</> : row.title}
                        {row.note && <small> — {row.note}</small>}
                      </td>
                      <td>{row.minutes}분</td>
                    </tr>
                  ))}
                  <tr className="print-service-total"><td colSpan={3}>총 예배 시간{setlist.startTime ? ` (${setlist.startTime} 시작)` : ''}</td><td>{formatMinutes(totalMinutes)}</td></tr>
                </tbody>
              </table>
            )}
            {p === 0 && pref.showList && !order && (
              <ol className="print-order">
                {songs.map((s) => (
                  <li key={s._id}>
                    {s.title}
                    {s.displayKey && <b> · {s.displayKey}</b>}
                    {s.bpm > 0 && <span> · {s.bpm} BPM</span>}
                  </li>
                ))}
              </ol>
            )}

            <div
              className="print-grid"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
            >
              {pageSongs.map((cell) => {
                const s = cell.song
                const keyNote = s.choice ? keyStateText(s.choice) : ''
                return (
                  <figure key={cell.key} className="print-cell">
                    <figcaption>
                      <b>{cell.number}. {s.title}{cell.pageTotal > 1 && ` (${cell.pageNo}/${cell.pageTotal})`}</b>
                      {s.displayKey && <span className="print-key">{s.displayKey}</span>}
                      {keyNote && cell.pageNo <= 1 && <small className="print-keynote">{keyNote}</small>}
                    </figcaption>
                    {cell.src ? (
                      <img src={cell.src} alt={`${s.title} 악보`} />
                    ) : (
                      <div className="print-empty">
                        {cell.error ? <>PDF를 열지 못했습니다<small>{cell.error} {cell.openUrl}</small></> : '악보 없음'}
                      </div>
                    )}
                    {s.displayNotes && cell.pageNo <= 1 && <p className="print-note">{s.displayNotes}</p>}
                  </figure>
                )
              })}
            </div>

            <footer className="print-foot">{COPYRIGHT_NOTICE}</footer>
          </div>
        ))}
      </div>
    </div>
  )
}
