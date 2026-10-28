import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAnnotation, getPublicAnnotation, saveAnnotation } from '../api/annotations'
import './SheetAnnotator.css'

// 악보 위 필기 공유
// - 로그인한 팀원: 펜·형광펜·지우개로 그리면 잠시 뒤 저장되고, 함께 보는 사람 화면에도 몇 초 안에 나타난다
// - 공유 링크로만 보는 사람: 필기를 보기만 한다 (켜기/끄기)
// 좌표는 악보 이미지 크기에 대한 비율(0~1)로 저장하므로 화면 크기·확대와 상관없이 같은 자리에 그려진다
// 필기는 악보 페이지(page)마다 따로 저장한다. 악보를 교체하면 페이지 번호가 바뀌어 예전 필기가 다른 페이지에 보이지 않는다

const PEN_COLORS = [
  { value: '#dc2626', label: '빨강' },
  { value: '#2563eb', label: '파랑' },
  { value: '#111827', label: '검정' },
]
const HIGHLIGHT_COLOR = '#facc15'
const WIDTHS = { pen: 4, highlighter: 22 } // 이미지 가로 1000 기준
const SAVE_DELAY_MS = 800
const POLL_MS = 4000
const RETRY_MS = 5000
const MAX_STROKES = 500
const MAX_POINTS = 2000
const UNDO_LIMIT = 50

const STATUS_TEXT = {
  saving: '저장 중…',
  saved: '저장됨',
  reloaded: '다른 사람이 수정해서 다시 불러왔어요',
  error: '저장하지 못했어요. 잠시 후 다시 시도할게요',
  lost: '편집 권한이 없어 보기 전용으로 바뀌었어요',
  full: `한 곡에 ${MAX_STROKES}획까지 그릴 수 있어요. 일부를 지워 주세요`,
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
const round4 = (n) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000

// 내가 저장하려던 변경(base → local)을 다른 사람이 먼저 저장한 필기(server) 위에 다시 얹는다
function mergeStrokes(local, base, server) {
  const baseIds = new Set(base.map((s) => s.id))
  const localIds = new Set(local.map((s) => s.id))
  const serverIds = new Set(server.map((s) => s.id))
  const removed = new Set([...baseIds].filter((id) => !localIds.has(id)))
  const added = local.filter((s) => !baseIds.has(s.id) && !serverIds.has(s.id))
  return [...server.filter((s) => !removed.has(s.id)), ...added]
}

function sameIds(a, b) {
  return a.length === b.length && a.every((s, i) => s.id === b[i].id)
}

function lineWidthFor(stroke, w) {
  return Math.max(stroke.tool === 'highlighter' ? 6 : 1.5, (stroke.width * w) / 1000)
}

function drawStroke(ctx, stroke, w, h) {
  const pts = stroke.points
  if (!pts.length) return
  ctx.save()
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = lineWidthFor(stroke, w)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.38
    ctx.globalCompositeOperation = 'multiply'
  }
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0][0] * w, pts[0][1] * h, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(pts[0][0] * w, pts[0][1] * h)
    for (let i = 1; i < pts.length - 1; i++) {
      // 점 사이를 부드럽게 잇는다
      const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * w
      const my = ((pts[i][1] + pts[i + 1][1]) / 2) * h
      ctx.quadraticCurveTo(pts[i][0] * w, pts[i][1] * h, mx, my)
    }
    const last = pts[pts.length - 1]
    ctx.lineTo(last[0] * w, last[1] * h)
    ctx.stroke()
  }
  ctx.restore()
}

// (x, y)는 화면 픽셀. 획에서 radius 안쪽이면 맞은 것으로 본다
function hitsStroke(stroke, x, y, w, h, radius) {
  const r = radius + lineWidthFor(stroke, w) / 2
  const r2 = r * r
  const pts = stroke.points
  for (let i = 0; i < pts.length; i++) {
    const ax = pts[i][0] * w
    const ay = pts[i][1] * h
    if (i === pts.length - 1) {
      if ((x - ax) ** 2 + (y - ay) ** 2 <= r2) return true
      break
    }
    const bx = pts[i + 1][0] * w
    const by = pts[i + 1][1] * h
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0
    if ((x - (ax + t * dx)) ** 2 + (y - (ay + t * dy)) ** 2 <= r2) return true
  }
  return false
}

// 불러오기·저장·주기적 동기화를 맡는다 (화면 그리기와는 분리)
class AnnotationSession {
  constructor({ shareToken, pin, songId, page, onChange }) {
    Object.assign(this, { shareToken, pin, songId, page, onChange })
    this.strokes = []
    this.base = { strokes: [], version: 0 } // 마지막으로 서버와 맞춘 상태
    this.canEdit = false
    this.setlistId = null
    this.undo = []
    this.dirty = false
    this.saving = false
    this.busy = false // 그리는 중
    this.status = ''
    this.errorText = ''
    this.disposed = false
    this.saveTimer = null
    this.statusTimer = null
  }

  start() {
    this.load()
    this.pollTimer = setInterval(() => this.poll(), POLL_MS)
    this.onVisible = () => { if (!document.hidden) this.poll() }
    document.addEventListener('visibilitychange', this.onVisible)
  }

  dispose() {
    this.disposed = true
    clearInterval(this.pollTimer)
    clearTimeout(this.saveTimer)
    clearTimeout(this.statusTimer)
    document.removeEventListener('visibilitychange', this.onVisible)
    // 곡을 넘기기 직전에 그린 것도 놓치지 않도록 바로 저장한다
    if (this.dirty && this.canEdit && !this.saving) this.save()
  }

  emit() {
    if (!this.disposed) this.onChange(this)
  }

  setStatus(status, errorText = '') {
    this.status = status
    this.errorText = errorText
    clearTimeout(this.statusTimer)
    if (status === 'saved' || status === 'reloaded' || status === 'full') {
      this.statusTimer = setTimeout(() => { this.setStatus(''); this.emit() }, status === 'saved' ? 2500 : 5000)
    }
  }

  async fetchLatest() {
    if (this.canEdit && this.setlistId) {
      try {
        return await getAnnotation(this.setlistId, this.songId, this.page)
      } catch (err) {
        if (![401, 403, 404].includes(err.status)) throw err
        // 팀에서 나갔거나 로그인이 끝남 → 보기 전용으로
        this.canEdit = false
        this.setlistId = null
        this.setStatus('lost')
      }
    }
    return getPublicAnnotation(this.shareToken, this.songId, this.pin, this.page)
  }

  applyServer(data) {
    this.base = { strokes: data.strokes || [], version: data.version || 0 }
    this.strokes = this.base.strokes
    this.undo = []
    this.dirty = false
  }

  async load() {
    try {
      const data = await this.fetchLatest()
      if (this.disposed) return
      this.canEdit = !!data.canEdit
      this.setlistId = data.setlistId || null
      this.applyServer(data)
      this.emit()
    } catch { /* 필기를 못 불러와도 악보는 그대로 보인다 */ }
  }

  async poll() {
    if (this.disposed || document.hidden || this.busy || this.dirty || this.saving) return
    try {
      const data = await this.fetchLatest()
      if (this.disposed || this.busy || this.dirty || this.saving) return
      if (data.version !== this.base.version) {
        this.applyServer(data)
        this.emit()
      }
    } catch { /* 다음 차례에 다시 */ }
  }

  // 내가 바꾼 내용: 되돌리기 기록을 남기고 잠시 뒤 저장한다
  commit(next, snapshot = this.strokes) {
    if (next === snapshot) return
    this.undo.push(snapshot)
    if (this.undo.length > UNDO_LIMIT) this.undo.shift()
    this.strokes = next
    this.dirty = true
    this.scheduleSave()
    this.emit()
  }

  addStroke(stroke) {
    if (this.strokes.length >= MAX_STROKES) {
      this.setStatus('full')
      this.emit()
      return
    }
    this.commit([...this.strokes, stroke])
  }

  undoLast() {
    const prev = this.undo.pop()
    if (!prev) return
    this.strokes = prev
    this.dirty = true
    this.scheduleSave()
    this.emit()
  }

  clearAll() {
    if (this.strokes.length) this.commit([])
  }

  scheduleSave(delay = SAVE_DELAY_MS) {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), delay)
  }

  async save() {
    if (!this.canEdit || !this.setlistId || !this.dirty) return
    if (this.saving || this.busy) { if (!this.disposed) this.scheduleSave(); return }
    this.saving = true
    const afterMerge = this.status === 'reloaded' // 합친 직후 다시 저장할 때는 안내 문구를 그대로 둔다
    if (!afterMerge) this.setStatus('saving')
    this.emit()
    const sending = this.strokes
    try {
      const data = await saveAnnotation(this.setlistId, this.songId, sending, this.base.version, this.page)
      this.base = { strokes: data.strokes, version: data.version }
      if (this.strokes === sending) {
        this.dirty = false
        if (!afterMerge) this.setStatus('saved')
      } else if (!this.disposed) {
        this.scheduleSave()
      }
    } catch (err) {
      if (err.status === 409 && this.busy) {
        // 그리는 중이면 손을 뗀 뒤 다시 저장하면서 합친다
        if (!this.disposed) this.scheduleSave()
      } else if (err.status === 409 && err.data) {
        // 다른 사람이 먼저 저장함 → 최신 필기를 받아 내 변경을 다시 얹는다
        const server = { strokes: err.data.strokes || [], version: err.data.version || 0 }
        const merged = mergeStrokes(this.strokes, this.base.strokes, server.strokes)
        this.base = server
        this.strokes = merged
        this.undo = []
        this.setStatus('reloaded')
        if (sameIds(merged, server.strokes)) this.dirty = false
        else if (!this.disposed) this.scheduleSave(0)
      } else if ([401, 403, 404].includes(err.status)) {
        this.canEdit = false
        this.setlistId = null
        this.dirty = false
        this.setStatus('lost')
      } else {
        // 400(너무 많음)·429(너무 잦음)는 서버 안내를 그대로 보여 준다
        if (err.status === 400 || err.status === 429) this.setStatus('', err.message)
        else this.setStatus('error')
        if (err.status !== 400 && !this.disposed) this.scheduleSave(RETRY_MS)
      }
    } finally {
      this.saving = false
      this.emit()
    }
  }
}

// toolbarHost: 도구 막대를 넣을 바깥 자리(DOM 요소). 주지 않으면 악보 위쪽에 띄운다 (null이면 자리가 생길 때까지 기다린다)
export default function SheetAnnotator({ shareToken, pin, songId, page, wrapStyle, dark = false, toolbarHost, children }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const [mode, setMode] = useState('view') // view | pen | highlighter | eraser
  const [color, setColor] = useState(PEN_COLORS[0].value)
  const [shown, setShown] = useState(true)
  const [info, setInfo] = useState({ canEdit: false, count: 0, undoCount: 0, status: '', errorText: '' })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const engine = { shown: true, drawing: null, erasing: null, size: { w: 0, h: 0 }, raf: 0 }

    function redraw() {
      cancelAnimationFrame(engine.raf)
      engine.raf = 0
      const { w, h } = engine.size
      const ctx = canvas.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!engine.shown || !w || !h) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (const s of session.strokes) drawStroke(ctx, s, w, h)
      if (engine.drawing) drawStroke(ctx, engine.drawing, w, h)
    }
    engine.redraw = redraw
    engine.requestRedraw = () => { if (!engine.raf) engine.raf = requestAnimationFrame(redraw) }

    const session = new AnnotationSession({
      shareToken, pin, songId, page,
      onChange: (s) => {
        setInfo({ canEdit: s.canEdit, count: s.strokes.length, undoCount: s.undo.length, status: s.status, errorText: s.errorText })
        if (!s.canEdit) setMode('view')
        redraw()
      },
    })
    engine.session = session

    // 캔버스를 화면에 보이는 악보 이미지 크기·위치에 맞춘다
    function fit() {
      const img = wrap.querySelector('img')
      if (!img) return
      const w = img.offsetWidth
      const h = img.offsetHeight
      const dpr = window.devicePixelRatio || 1
      Object.assign(canvas.style, { left: `${img.offsetLeft}px`, top: `${img.offsetTop}px`, width: `${w}px`, height: `${h}px` })
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      engine.size = { w, h }
      redraw()
    }
    engine.fit = fit
    const img = wrap.querySelector('img')
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    if (img) {
      ro.observe(img)
      img.addEventListener('load', fit)
    }
    window.addEventListener('resize', fit) // 화면 배율(devicePixelRatio)이 바뀐 경우
    fit()

    engineRef.current = engine
    session.start()
    return () => {
      ro.disconnect()
      img?.removeEventListener('load', fit)
      window.removeEventListener('resize', fit)
      cancelAnimationFrame(engine.raf)
      session.dispose()
      engineRef.current = null
    }
  }, [shareToken, pin, songId, page])

  function toggleShown() {
    const next = !shown
    setShown(next)
    const engine = engineRef.current
    if (engine) { engine.shown = next; engine.redraw() }
  }

  function chooseMode(next) {
    setMode(next)
    if (next !== 'view' && !shown) toggleShown()
  }

  // ── 그리기 ──
  function pointFrom(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }
  }

  function eraseAt(engine, p) {
    const { session } = engine
    // 손가락이 빨리 움직여도 지나간 길 전체를 확인한다
    const from = engine.lastPx || p
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / 6))
    engine.lastPx = p
    const samples = [...Array(steps + 1)].map((_, i) => ({ x: from.x + ((p.x - from.x) * i) / steps, y: from.y + ((p.y - from.y) * i) / steps }))
    const hit = session.strokes.filter((s) => samples.some((q) => hitsStroke(s, q.x, q.y, p.w, p.h, 12)))
    if (!hit.length) return
    const ids = new Set(hit.map((s) => s.id))
    session.strokes = session.strokes.filter((s) => !ids.has(s.id))
    engine.requestRedraw()
  }

  function handlePointerDown(e) {
    const engine = engineRef.current
    if (!engine || mode === 'view' || !engine.session.canEdit) return
    if (engine.activePointer != null) return // 손바닥 등 두 번째 손가락은 무시
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    engine.activePointer = e.pointerId
    engine.session.busy = true
    const p = pointFrom(e)
    if (mode === 'eraser') {
      engine.erasing = engine.session.strokes
      engine.lastPx = p
      eraseAt(engine, p)
      return
    }
    engine.drawing = {
      id: newId(),
      tool: mode,
      color: mode === 'highlighter' ? HIGHLIGHT_COLOR : color,
      width: WIDTHS[mode],
      points: [[round4(p.x / p.w), round4(p.y / p.h)]],
    }
    engine.lastPx = p
    engine.requestRedraw()
  }

  function handlePointerMove(e) {
    const engine = engineRef.current
    if (!engine || engine.activePointer !== e.pointerId) return
    e.preventDefault()
    const p = pointFrom(e)
    if (engine.erasing) { eraseAt(engine, p); return }
    const d = engine.drawing
    if (!d || d.points.length >= MAX_POINTS) return
    if (Math.hypot(p.x - engine.lastPx.x, p.y - engine.lastPx.y) < 1.5) return
    d.points.push([round4(p.x / p.w), round4(p.y / p.h)])
    engine.lastPx = p
    engine.requestRedraw()
  }

  function handlePointerUp(e) {
    const engine = engineRef.current
    if (!engine || engine.activePointer !== e.pointerId) return
    engine.activePointer = null
    const { session } = engine
    session.busy = false
    if (engine.erasing) {
      const before = engine.erasing
      engine.erasing = null
      const after = session.strokes
      session.strokes = before
      session.commit(after, before)
      return
    }
    const d = engine.drawing
    engine.drawing = null
    if (d) session.addStroke(d)
    else engine.redraw()
  }

  function clearAll() {
    if (!window.confirm('이 페이지의 필기를 모두 지울까요?\n함께 보는 팀원 화면에서도 지워집니다.')) return
    engineRef.current?.session.clearAll()
  }

  const drawingMode = info.canEdit && mode !== 'view'
  const statusText = info.errorText || STATUS_TEXT[info.status] || ''
  const stop = (e) => { if (drawingMode) e.stopPropagation() } // 그리는 동안 좌우 넘김(스와이프) 막기

  const toolbar = (info.canEdit || info.count > 0) && (
    <div className={`annot-toolbar${toolbarHost !== undefined ? ' annot-toolbar--inline' : ''}`} onTouchStart={stop} onTouchEnd={stop}>
      {info.canEdit && !drawingMode && (
        <button type="button" className="annot-btn annot-btn--main" onClick={() => chooseMode('pen')}>✏️ 필기하기</button>
      )}
      {drawingMode && (
        <>
          <button type="button" className="annot-btn" onClick={() => chooseMode('view')} title="필기를 마치고 악보 넘기기·스크롤로 돌아가기">✋ 보기</button>
          <button type="button" className={`annot-btn${mode === 'pen' ? ' is-on' : ''}`} onClick={() => chooseMode('pen')}>🖊 펜</button>
          <button type="button" className={`annot-btn${mode === 'highlighter' ? ' is-on' : ''}`} onClick={() => chooseMode('highlighter')}>🖍 형광펜</button>
          <button type="button" className={`annot-btn${mode === 'eraser' ? ' is-on' : ''}`} onClick={() => chooseMode('eraser')} title="문지른 획을 통째로 지웁니다">🧽 지우개</button>
          {mode === 'pen' && (
            <span className="annot-colors">
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`annot-color${color === c.value ? ' is-on' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  aria-label={`${c.label} 펜`}
                />
              ))}
            </span>
          )}
          <button type="button" className="annot-btn" onClick={() => engineRef.current?.session.undoLast()} disabled={!info.undoCount}>↩ 되돌리기</button>
          <button type="button" className="annot-btn annot-btn--danger" onClick={clearAll} disabled={!info.count}>🗑 전체 지우기</button>
        </>
      )}
      {!drawingMode && info.count > 0 && (
        <button type="button" className="annot-btn" onClick={toggleShown}>
          {shown ? '👁 필기 보기 끄기' : '👁 필기 보기 켜기'}
        </button>
      )}
      {statusText && <span className={`annot-status${info.status === 'error' || info.errorText ? ' is-error' : ''}`}>{statusText}</span>}
    </div>
  )

  return (
    <div ref={wrapRef} className="annot-wrap" style={wrapStyle}>
      {toolbarHost === undefined
        ? <div className={`annot-dock${dark ? ' annot-dock--dark' : ''}`}>{toolbar}</div>
        : toolbarHost && toolbar && createPortal(toolbar, toolbarHost)}
      {children}
      <canvas
        ref={canvasRef}
        className={`annot-canvas${drawingMode ? ' is-drawing' : ''}${mode === 'eraser' ? ' is-erasing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={stop}
        onTouchEnd={stop}
        aria-hidden="true"
      />
    </div>
  )
}
