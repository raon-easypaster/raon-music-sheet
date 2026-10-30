import { useState } from 'react'
import { FLOW_PARTS, FLOW_MAX, FLOW_NOTE_MAX, FLOW_LABEL_MAX, flowCode, flowText, parseStructure } from '../utils/flow'

// 누르면 맨 뒤에 붙는 칸들 (휴대폰에서도 누르기 쉽게 끌어서 옮기기 대신 버튼만 쓴다)
const PALETTE = [
  { part: 'intro', n: 0 },
  { part: 'verse', n: 1 },
  { part: 'verse', n: 2 },
  { part: 'verse', n: 3 },
  { part: 'pre', n: 0 },
  { part: 'chorus', n: 0 },
  { part: 'bridge', n: 0 },
  { part: 'inter', n: 0 },
  { part: 'outro', n: 0 },
  { part: 'ending', n: 0 },
]
const NOTE_PRESETS = ['verse 없이 바로', '조용히', '악기만', '다 같이 크게', 'Key 올림', '천천히', '마지막 한 번 더']

const sameKind = (a, b) => !!a && !!b && a.part === b.part && (a.n || 0) === (b.n || 0) && (a.label || '') === (b.label || '')

// 읽기 전용 진행 막대 (콘티 화면·공유 화면·인쇄)
export function FlowChips({ flow, className = '' }) {
  if (!flow?.length) return null
  return (
    <ol className={`flow-chips ${className}`} aria-label={`진행: ${flowText(flow)}`}>
      {flow.map((it, i) => (
        <li key={i}>
          <span className={`flow-chip flow-${it.part}`}>
            <b>{flowCode(it)}</b>
            {it.times > 1 && <span className="flow-times">×{it.times}</span>}
            {it.note && <span className="flow-note">{it.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

// 콘티 곡 설정 안의 진행 편집기. value: 칸 배열, structure: 곡에 적어 둔 송폼 글자
export default function FlowEditor({ value, onChange, structure }) {
  const flow = value || []
  const [sel, setSel] = useState(null) // 고른 칸 번호
  const [custom, setCustom] = useState(null) // 직접 입력 칸 이름
  const fromSong = parseStructure(structure)
  const full = flow.length >= FLOW_MAX

  const set = (next, nextSel = sel) => { onChange(next); setSel(nextSel) }
  const patch = (i, p) => set(flow.map((it, j) => (j === i ? { ...it, ...p } : it)))

  function add(item) {
    const last = flow[flow.length - 1]
    // 바로 앞과 같은 칸을 또 누르면 반복 횟수를 올린다 (C, C → C ×2)
    if (sameKind(last, item) && !last.note && last.times < 9) {
      set(flow.map((it, j) => (j === flow.length - 1 ? { ...it, times: it.times + 1 } : it)), flow.length - 1)
      return
    }
    if (full) return
    set([...flow, { times: 1, note: '', label: '', ...item }], flow.length)
  }

  function addCustom() {
    const label = (custom || '').trim().slice(0, FLOW_LABEL_MAX)
    if (label) add({ part: 'etc', n: 0, label })
    setCustom(null)
  }

  function move(i, dir) {
    const to = i + dir
    if (to < 0 || to >= flow.length) return
    const next = [...flow]
    ;[next[i], next[to]] = [next[to], next[i]]
    set(next, to)
  }

  function loadFromSong() {
    if (flow.length && !window.confirm('지금 적은 진행을 지우고 곡의 기본 송폼으로 다시 시작할까요?')) return
    set(fromSong, null)
  }

  const it = sel !== null ? flow[sel] : null

  return (
    <div className="flow-editor">
      <div className="flow-palette" role="group" aria-label="진행 칸 추가">
        {PALETTE.map((p) => (
          <button key={`${p.part}${p.n}`} type="button" className={`secondary flow-add flow-${p.part}`} onClick={() => add(p)} disabled={full}
            title={`${FLOW_PARTS[p.part].name}${p.n ? ` ${p.n}절` : ''} 칸을 맨 뒤에 붙입니다`}>
            {flowCode(p)}
          </button>
        ))}
        {custom === null ? (
          <button type="button" className="secondary flow-add" onClick={() => setCustom('')} disabled={full} title="Tag, 기도, 선포 같은 칸을 직접 이름 붙여 넣습니다">
            + 직접
          </button>
        ) : (
          <span className="flow-custom">
            <input type="text" value={custom} maxLength={FLOW_LABEL_MAX} placeholder="예: Tag, 기도" autoFocus aria-label="직접 입력 칸 이름"
              onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} />
            <button type="button" onClick={addCustom}>넣기</button>
          </span>
        )}
      </div>

      {flow.length === 0 ? (
        <p className="muted-dark flow-empty">
          위 버튼을 부를 순서대로 누르세요. 비워 두면 곡의 기본 송폼{structure ? ` (${structure})` : ''}을 씁니다.
        </p>
      ) : (
        <ol className="flow-chips flow-chips-edit" aria-label="진행 (눌러서 고치기)">
          {flow.map((x, i) => (
            <li key={i}>
              <button type="button" className={`flow-chip flow-${x.part}${sel === i ? ' selected' : ''}`} onClick={() => setSel(sel === i ? null : i)}
                aria-pressed={sel === i} aria-label={`${i + 1}번째 칸 ${flowCode(x)}${x.times > 1 ? ` ${x.times}번` : ''}${x.note ? ` ${x.note}` : ''}`}>
                <b>{flowCode(x)}</b>
                {x.times > 1 && <span className="flow-times">×{x.times}</span>}
                {x.note && <span className="flow-note">{x.note}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}

      {it && (
        <div className="flow-tools">
          <div className="flow-tools-row">
            <b>{sel + 1}번째 칸 · {flowCode(it)}</b>
            <button type="button" className="secondary" onClick={() => move(sel, -1)} disabled={sel === 0} aria-label="앞으로">◀</button>
            <button type="button" className="secondary" onClick={() => move(sel, 1)} disabled={sel === flow.length - 1} aria-label="뒤로">▶</button>
            <span className="flow-stepper" aria-label="반복">
              반복
              <button type="button" className="secondary" onClick={() => patch(sel, { times: it.times - 1 })} disabled={it.times <= 1} aria-label="반복 줄이기">−</button>
              <b>{it.times}번</b>
              <button type="button" className="secondary" onClick={() => patch(sel, { times: it.times + 1 })} disabled={it.times >= 9} aria-label="반복 늘리기">+</button>
            </span>
            {FLOW_PARTS[it.part]?.numbered && (
              <label className="flow-num">
                번호
                <select value={it.n} onChange={(e) => patch(sel, { n: Number(e.target.value) })}>
                  <option value={0}>없음</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <button type="button" className="secondary" onClick={() => set(flow.filter((_, j) => j !== sel), null)}>이 칸 빼기</button>
          </div>
          <div className="flow-tools-row">
            <input type="text" value={it.note} maxLength={FLOW_NOTE_MAX} placeholder="이 칸 메모 (예: verse 없이 바로)" aria-label="이 칸 메모"
              onChange={(e) => patch(sel, { note: e.target.value })} />
          </div>
          <div className="flow-presets">
            {NOTE_PRESETS.map((t) => (
              <button key={t} type="button" className={`secondary${it.note === t ? ' active' : ''}`} onClick={() => patch(sel, { note: it.note === t ? '' : t })}>{t}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flow-footer">
        {fromSong.length > 0 && (
          <button type="button" className="secondary" onClick={loadFromSong} title={structure}>곡 기본 송폼 불러오기</button>
        )}
        {flow.length > 0 && <button type="button" className="secondary" onClick={() => set(flow.slice(0, -1), null)}>마지막 칸 빼기</button>}
        {flow.length > 0 && <button type="button" className="secondary" onClick={() => set([], null)}>모두 지우기</button>}
        {full && <span className="muted-dark">{FLOW_MAX}칸까지 적을 수 있어요</span>}
      </div>
      {flow.length > 0 && <p className="flow-preview">{flowText(flow)}</p>}
    </div>
  )
}
