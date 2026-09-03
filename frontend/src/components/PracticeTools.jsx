import { useState, useRef, useEffect } from 'react'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MINOR = ['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

function transposeKey(key, semitones) {
  const isMinor = key.endsWith('m')
  const base = isMinor ? key.slice(0, -1) : key
  const arr = isMinor ? MINOR.map(k => k.slice(0, -1)) : NOTES
  const idx = arr.indexOf(base)
  if (idx === -1) return key
  const newBase = arr[(idx + semitones + 12) % 12]
  return isMinor ? newBase + 'm' : newBase
}

// ── 메트로놈 ──────────────────────────────────────────
function Metronome() {
  const [bpm, setBpm] = useState(100)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(false)
  const [tapTimes, setTapTimes] = useState([])
  const intervalRef = useRef(null)
  const audioCtx = useRef(null)

  function getCtx() {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    return audioCtx.current
  }

  function tick() {
    const ctx = getCtx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.05)
    setBeat(true)
    setTimeout(() => setBeat(false), 80)
  }

  useEffect(() => {
    if (running) {
      tick()
      intervalRef.current = setInterval(tick, (60 / bpm) * 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, bpm])

  function handleTap() {
    const now = Date.now()
    setTapTimes(prev => {
      const recent = [...prev, now].filter(t => now - t < 3000).slice(-8)
      if (recent.length >= 2) {
        const gaps = recent.slice(1).map((t, i) => t - recent[i])
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
        setBpm(Math.round(60000 / avg))
      }
      return recent
    })
  }

  return (
    <div className="card panel" style={{ textAlign: 'center' }}>
      <h3 style={{ marginTop: 0 }}>🥁 메트로놈</h3>

      <div style={{
        width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
        background: beat ? '#15803d' : '#e2e8f0',
        transition: 'background 0.05s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28
      }}>♩</div>

      <div style={{ fontSize: 42, fontWeight: 800, color: '#14532d', marginBottom: 4 }}>{bpm}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>BPM</div>

      <input
        type="range" min="40" max="220" value={bpm}
        onChange={e => setBpm(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 16 }}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
        <button className="secondary" style={{ fontSize: 13 }} onClick={() => setBpm(b => Math.max(40, b - 5))}>−5</button>
        <button className="secondary" style={{ fontSize: 13 }} onClick={() => setBpm(b => Math.max(40, b - 1))}>−1</button>
        <button className="secondary" style={{ fontSize: 13 }} onClick={() => setBpm(b => Math.min(220, b + 1))}>+1</button>
        <button className="secondary" style={{ fontSize: 13 }} onClick={() => setBpm(b => Math.min(220, b + 5))}>+5</button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button
          style={{ background: running ? '#dc2626' : '#15803d', color: '#fff', minWidth: 80 }}
          onClick={() => setRunning(r => !r)}
        >
          {running ? '■ 정지' : '▶ 시작'}
        </button>
        <button className="secondary" onClick={handleTap} style={{ minWidth: 80 }}>
          👆 탭
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>탭 버튼을 여러 번 눌러 BPM 자동 측정</p>
    </div>
  )
}

// ── 카포 계산기 ────────────────────────────────────────
function CapoCalc() {
  const [originalKey, setOriginalKey] = useState('G')
  const [capo, setCapo] = useState(0)
  const allKeys = [...NOTES, ...MINOR]
  const transposed = transposeKey(originalKey, -capo)

  return (
    <div className="card panel">
      <h3 style={{ marginTop: 0 }}>🎸 카포 계산기</h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        카포 없이 연주하는 실제 Key를 선택하고 카포 위치를 설정하면 악보에 적힌 Key를 계산합니다.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>원래 Key (악보 Key)</label>
          <select
            value={originalKey}
            onChange={e => setOriginalKey(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
          >
            {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>카포 위치 (프렛)</label>
          <select
            value={capo}
            onChange={e => setCapo(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
          >
            {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n === 0 ? '카포 없음' : `${n}프렛`}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#15803d', marginBottom: 4 }}>카포 {capo}프렛 시 실제 연주 Key</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#14532d' }}>{transposed}</div>
        {capo > 0 && (
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            악보 Key {originalKey} → 카포 {capo}프렛 → 실제 소리 {transposed}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>전체 카포 위치별 Key</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[1,2,3,4,5,6,7].map(n => (
            <div
              key={n}
              onClick={() => setCapo(n)}
              style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                background: capo === n ? '#15803d' : '#f1f5f9',
                color: capo === n ? '#fff' : '#374151',
                fontWeight: capo === n ? 700 : 400,
              }}
            >
              {n}프 → {transposeKey(originalKey, -n)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 크로매틱 튜너 ─────────────────────────────────────
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return -1

  let r1 = 0, r2 = SIZE - 1
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < 0.2) { r1 = i; break }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < 0.2) { r2 = SIZE - i; break }
  const trimmed = buf.slice(r1, r2)
  const c = new Float32Array(trimmed.length * 2)
  for (let i = 0; i < trimmed.length; i++)
    for (let j = 0; j < trimmed.length; j++) c[i + j] += trimmed[i] * trimmed[j]

  let d = 0
  while (c[d] > c[d + 1]) d++
  let maxval = -1, maxpos = -1
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i }
  }
  let T0 = maxpos
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2
  if (a) T0 -= b / (2 * a)
  return sampleRate / T0
}

function freqToNote(freq) {
  if (freq <= 0) return null
  const semitones = 12 * Math.log2(freq / 440)
  const midi = Math.round(semitones) + 69
  const cents = Math.round((semitones - (midi - 69)) * 100)
  const note = NOTES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return { note, octave, cents }
}

function Tuner() {
  const [active, setActive] = useState(false)
  const [detected, setDetected] = useState(null)
  const [error, setError] = useState('')
  const rafRef = useRef(null)
  const streamRef = useRef(null)
  const analyserRef = useRef(null)
  const ctxRef = useRef(null)

  function stop() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
    analyserRef.current = null; ctxRef.current = null; streamRef.current = null
    setActive(false); setDetected(null)
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyserRef.current = analyser
      analyser.fftSize = 2048
      ctx.createMediaStreamSource(stream).connect(analyser)
      setActive(true)

      const buf = new Float32Array(analyser.fftSize)
      const loop = () => {
        analyser.getFloatTimeDomainData(buf)
        const freq = autoCorrelate(buf, ctx.sampleRate)
        setDetected(freq > 0 ? freqToNote(freq) : null)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (e) {
      setError('마이크 접근 권한이 필요합니다')
    }
  }

  useEffect(() => stop, [])

  const cents = detected?.cents ?? 0
  const inTune = Math.abs(cents) < 5
  const needsUp = cents < -5
  const needsDown = cents > 5

  return (
    <div className="card panel" style={{ textAlign: 'center' }}>
      <h3 style={{ marginTop: 0 }}>🎸 크로매틱 튜너</h3>

      <div style={{
        width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px',
        background: !active ? '#e2e8f0' : inTune ? '#15803d' : '#f59e0b',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.2s',
      }}>
        {detected ? (
          <>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{detected.note}</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{detected.octave}</span>
          </>
        ) : (
          <span style={{ fontSize: 28, color: active ? '#94a3b8' : '#cbd5e1' }}>♩</span>
        )}
      </div>

      {detected && (
        <>
          <div style={{ fontSize: 13, color: inTune ? '#15803d' : '#f59e0b', fontWeight: 700, marginBottom: 6 }}>
            {inTune ? '✓ 정확합니다' : needsUp ? '▲ 올려야 합니다' : '▼ 내려야 합니다'}
          </div>
          <div style={{ position: 'relative', height: 8, background: '#e2e8f0', borderRadius: 4, margin: '0 20px 8px' }}>
            <div style={{
              position: 'absolute', left: '50%', top: -2, width: 12, height: 12,
              borderRadius: '50%', background: inTune ? '#15803d' : '#f59e0b',
              transform: `translateX(calc(-50% + ${Math.max(-100, Math.min(100, cents))}%))`,
              transition: 'transform 0.1s',
            }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 8, background: '#94a3b8', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{cents > 0 ? '+' : ''}{cents} cents</div>
        </>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '8px 0' }}>{error}</p>}

      <button
        style={{ background: active ? '#dc2626' : '#15803d', color: '#fff', marginTop: 16, minWidth: 100 }}
        onClick={active ? stop : start}
      >
        {active ? '■ 끄기' : '🎤 시작'}
      </button>
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>마이크에 악기 소리를 내주세요</p>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────
export default function PracticeTools() {
  return (
    <div>
      <div className="tools-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Metronome />
        <Tuner />
        <CapoCalc />
      </div>
    </div>
  )
}
