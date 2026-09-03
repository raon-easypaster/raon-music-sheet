import { useState } from 'react'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Open string MIDI (high → low, top → bottom on screen)
const GUITAR_OPEN  = [64, 59, 55, 50, 45, 40]   // E4 B3 G3 D3 A2 E2
const GUITAR_NAMES = ['E','B','G','D','A','E']
const BASS_OPEN    = [43, 38, 33, 28]             // G2 D2 A1 E1
const BASS_NAMES   = ['G','D','A','E']

const DOT_FRETS = [3, 5, 7, 9, 12]
const NUM_FRETS  = 13  // frets 0-12

const SCALES = {
  'Major (장음계)':            [0,2,4,5,7,9,11],
  'Natural Minor (단음계)':    [0,2,3,5,7,8,10],
  'Major Pentatonic (메이저 펜타)': [0,2,4,7,9],
  'Minor Pentatonic (마이너 펜타)': [0,3,5,7,10],
  'Blues (블루스)':            [0,3,5,6,7,10],
  'Dorian (도리안)':           [0,2,3,5,7,9,10],
  'Mixolydian (믹솔리디안)':   [0,2,4,5,7,9,10],
}

// SVG layout constants
const LBL_W   = 24   // string name label width
const OPEN_W  = 36   // open-string column width
const FRET_W  = 48   // one fret width
const STR_H   = 34   // gap between strings
const PAD_T   = 32   // top padding (fret numbers)
const PAD_B   = 20
const PAD_R   = 16

function Fretboard({ openNotes, stringNames, rootNote, scaleIntervals }) {
  const nStr  = openNotes.length
  const svgW  = LBL_W + OPEN_W + NUM_FRETS * FRET_W + PAD_R
  const svgH  = PAD_T + (nStr - 1) * STR_H + PAD_B
  const nutX  = LBL_W + OPEN_W
  const scaleSet = new Set(scaleIntervals)

  function info(midi) {
    const semi = ((midi - rootNote) % 12 + 12) % 12
    return { inScale: scaleSet.has(semi), isRoot: semi === 0, name: NOTES[((midi % 12) + 12) % 12] }
  }

  function noteX(fret) {
    return fret === 0
      ? LBL_W + OPEN_W / 2
      : nutX + (fret - 0.5) * FRET_W
  }

  function noteY(si) { return PAD_T + si * STR_H }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block', minWidth: svgW, width: '100%', maxWidth: svgW }}
      >
        {/* ─── Fret dots (position markers) ─── */}
        {DOT_FRETS.map(f => {
          const cx = nutX + (f - 0.5) * FRET_W
          const midY = PAD_T + ((nStr - 1) * STR_H) / 2
          if (f === 12) return (
            <g key={f}>
              <circle cx={cx} cy={midY - STR_H * 0.6} r={5} fill="#e2e8f0" />
              <circle cx={cx} cy={midY + STR_H * 0.6} r={5} fill="#e2e8f0" />
            </g>
          )
          return <circle key={f} cx={cx} cy={midY} r={5} fill="#e2e8f0" />
        })}

        {/* ─── Fret lines ─── */}
        {Array.from({ length: NUM_FRETS }, (_, f) => f + 1).map(f => (
          <line
            key={f}
            x1={nutX + f * FRET_W} y1={PAD_T}
            x2={nutX + f * FRET_W} y2={PAD_T + (nStr - 1) * STR_H}
            stroke={f === 12 ? '#64748b' : '#cbd5e1'} strokeWidth={f === 12 ? 2.5 : 1.5}
          />
        ))}

        {/* ─── Nut ─── */}
        <rect x={nutX - 3} y={PAD_T - 2} width={5} height={(nStr - 1) * STR_H + 4}
          fill="#475569" rx={2} />

        {/* ─── Fret numbers ─── */}
        {[1,3,5,7,9,12].map(f => (
          <text key={f} x={nutX + (f - 0.5) * FRET_W} y={PAD_T - 9}
            textAnchor="middle" fontSize={11} fill="#94a3b8">{f}</text>
        ))}
        <text x={LBL_W + OPEN_W / 2} y={PAD_T - 9}
          textAnchor="middle" fontSize={11} fill="#94a3b8">0</text>

        {/* ─── Strings + labels ─── */}
        {openNotes.map((_, si) => {
          const y = noteY(si)
          const thick = 1 + (nStr - 1 - si) * 0.45
          return (
            <g key={si}>
              <line x1={nutX - 3} y1={y} x2={svgW - PAD_R} y2={y}
                stroke="#94a3b8" strokeWidth={thick} />
              {/* open string dashed line to label */}
              <line x1={LBL_W} y1={y} x2={nutX - 3} y2={y}
                stroke="#cbd5e1" strokeWidth={thick} strokeDasharray="3 3" />
              <text x={LBL_W - 5} y={y + 4}
                textAnchor="end" fontSize={12} fill="#64748b" fontWeight={700}>
                {stringNames[si]}
              </text>
            </g>
          )
        })}

        {/* ─── Note circles ─── */}
        {openNotes.map((open, si) => (
          Array.from({ length: NUM_FRETS }, (_, f) => {
            const { inScale, isRoot, name } = info(open + f)
            if (!inScale) return null
            const cx = noteX(f)
            const cy = noteY(si)
            return (
              <g key={`${si}-${f}`}>
                <circle cx={cx} cy={cy} r={13}
                  fill={isRoot ? '#15803d' : '#bbf7d0'}
                  stroke={isRoot ? '#14532d' : '#4ade80'}
                  strokeWidth={1.5} />
                <text x={cx} y={cy + 4}
                  textAnchor="middle" fontSize={10} fontWeight={700}
                  fill={isRoot ? '#fff' : '#14532d'}>
                  {name}
                </text>
              </g>
            )
          })
        ))}
      </svg>
    </div>
  )
}

export default function ScaleChart() {
  const [instrument, setInstrument] = useState('guitar')
  const [rootIdx, setRootIdx] = useState(7)   // G by default
  const [scaleKey, setScaleKey] = useState('Major Pentatonic (메이저 펜타)')

  const isGuitar   = instrument === 'guitar'
  const openNotes  = isGuitar ? GUITAR_OPEN : BASS_OPEN
  const stringNames = isGuitar ? GUITAR_NAMES : BASS_NAMES
  const scaleIntervals = SCALES[scaleKey]

  return (
    <div className="card panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>🎸 스케일표</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{ fontSize: 13, padding: '5px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: isGuitar ? '#15803d' : '#e2e8f0', color: isGuitar ? '#fff' : '#374151', fontWeight: 600 }}
            onClick={() => setInstrument('guitar')}>기타 6현</button>
          <button
            style={{ fontSize: 13, padding: '5px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: !isGuitar ? '#15803d' : '#e2e8f0', color: !isGuitar ? '#fff' : '#374151', fontWeight: 600 }}
            onClick={() => setInstrument('bass')}>베이스 4현</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Root note selector */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>ROOT KEY</label>
          <select
            value={rootIdx}
            onChange={e => setRootIdx(Number(e.target.value))}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 700 }}
          >
            {NOTES.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        </div>
        {/* Scale selector */}
        <div style={{ flex: 2, minWidth: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>SCALE</label>
          <select
            value={scaleKey}
            onChange={e => setScaleKey(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
          >
            {Object.keys(SCALES).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#15803d' }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>루트 ({NOTES[rootIdx]})</span>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#bbf7d0', border: '1px solid #4ade80' }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>스케일 음</span>
        </div>
      </div>

      {/* Fretboard */}
      <Fretboard
        openNotes={openNotes}
        stringNames={stringNames}
        rootNote={rootIdx + 60}  /* middle C is MIDI 60, C4; offset so rootIdx matches note name */
        scaleIntervals={scaleIntervals}
      />

      {/* Scale intervals display */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>이 스케일의 구성음</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {scaleIntervals.map(semi => {
            const noteIdx = (rootIdx + semi) % 12
            const isRoot = semi === 0
            return (
              <span key={semi} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                background: isRoot ? '#15803d' : '#f0fdf4',
                color: isRoot ? '#fff' : '#14532d',
                border: `1px solid ${isRoot ? '#14532d' : '#bbf7d0'}`,
              }}>
                {NOTES[noteIdx]}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
