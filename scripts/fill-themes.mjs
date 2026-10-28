// 기존 곡 중 주제·절기 태그가 없는 곡에 주제를 채운다.
//
// 1) 주제 없는 곡 목록 받기:   node scripts/fill-themes.mjs export
//    → work/themes-missing.json
// 2) 각 곡의 주제를 정해 work/themes-fill.json 으로 저장 (형식은 아래)
// 3) 앱에 저장하기:            node scripts/fill-themes.mjs apply
//
// themes-fill.json 형식: [{ "id": "곡 id", "title": "확인용 제목", "themes": ["은혜", "감사"], "target": "하나님", "traits": ["고백"] }]
// - 이미 주제가 있는 곡은 건드리지 않는다 (그 사이 누가 넣었으면 그대로 둔다)
// - target·traits는 비어 있는 곡에만 채운다
// - 로그인 이메일·비밀번호는 이 컴퓨터 터미널에서 직접 입력하며 어디에도 저장하지 않는다

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const API = (process.env.RAON_API || 'https://raon-music-sheet.vercel.app/api').replace(/\/$/, '')
const WORK = path.resolve('work')
const MISSING = path.join(WORK, 'themes-missing.json')
const FILL = path.join(WORK, 'themes-fill.json')

// 입력 창은 하나만 열어 계속 쓰고, 미리 입력된 줄은 차례로 쌓아 두었다가 질문마다 하나씩 꺼낸다
let rl = null
let hideInput = false
const lines = []
const waiting = []
function ask(question, { hidden = false } = {}) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
    const write = rl._writeToOutput.bind(rl)
    // 비밀번호를 입력하는 동안에는 입력한 글자를 화면에 보여 주지 않는다
    rl._writeToOutput = (str) => { if (!hideInput) write(str) }
    rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)))
    rl.on('close', () => { while (waiting.length) waiting.shift()('') })
  }
  process.stdout.write(question)
  hideInput = hidden
  return new Promise((resolve) => {
    const take = (line) => {
      if (hidden) process.stdout.write('\n')
      hideInput = false
      resolve(line.trim())
    }
    if (lines.length) take(lines.shift())
    else waiting.push(take)
  })
}

async function call(method, endpoint, token, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`)
  return data
}

async function login() {
  const email = await ask('앱 로그인 이메일: ')
  const password = await ask('비밀번호 (입력해도 화면에 안 보임): ', { hidden: true })
  const { token } = await call('POST', '/auth/login', null, { email, password })
  return token
}

// 개인 공간 또는 팀 공간 고르기
async function chooseWorkspace(token) {
  const teams = await call('GET', '/teams', token)
  if (!teams.length) return { team: '', label: '개인' }
  console.log('\n어느 공간의 곡을 채울까요?')
  console.log('  0) 내 개인 공간')
  teams.forEach((t, i) => console.log(`  ${i + 1}) 팀: ${t.name}`))
  const n = Number(await ask('번호: '))
  const t = teams[n - 1]
  return t ? { team: t._id, label: `팀 ${t.name}` } : { team: '', label: '개인' }
}

const songsPath = (team) => (team ? `/songs?team=${team}` : '/songs')
const empty = (list) => !Array.isArray(list) || list.length === 0

async function exportMissing() {
  const token = await login()
  const ws = await chooseWorkspace(token)
  const songs = await call('GET', songsPath(ws.team), token)
  const missing = songs
    .filter((s) => empty(s.themes))
    .map((s) => ({ id: s._id, title: s.title, artist: s.artist || '', key: s.key || '', bpm: s.bpm || 0, target: s.target || '', traits: s.traits || [], themes: [] }))
  fs.mkdirSync(WORK, { recursive: true })
  fs.writeFileSync(MISSING, JSON.stringify({ workspace: ws, songs: missing }, null, 2))
  console.log(`\n${ws.label} 공간: 전체 ${songs.length}곡 중 주제 없는 곡 ${missing.length}곡`)
  console.log(`목록을 저장했습니다: ${MISSING}`)
}

async function apply() {
  if (!fs.existsSync(FILL)) throw new Error(`${FILL} 파일이 없습니다. 먼저 주제를 정해 이 파일을 만들어 주세요.`)
  const fill = JSON.parse(fs.readFileSync(FILL, 'utf8'))
  const list = Array.isArray(fill) ? fill : fill.songs
  if (!Array.isArray(list)) throw new Error('themes-fill.json 형식이 맞지 않습니다')

  const token = await login()
  const ws = await chooseWorkspace(token)
  const current = new Map((await call('GET', songsPath(ws.team), token)).map((s) => [s._id, s]))

  const plan = []
  for (const item of list) {
    const song = current.get(item.id)
    if (!song) { console.log(`  건너뜀 (이 공간에 없는 곡): ${item.title || item.id}`); continue }
    if (!empty(song.themes)) { console.log(`  건너뜀 (이미 주제 있음): ${song.title}`); continue }
    if (empty(item.themes)) continue
    const patch = { themes: item.themes }
    if (!song.target && item.target) patch.target = item.target
    if (empty(song.traits) && !empty(item.traits)) patch.traits = item.traits
    plan.push({ song, patch })
  }

  console.log(`\n${ws.label} 공간에 주제를 넣을 곡: ${plan.length}곡`)
  plan.slice(0, 10).forEach(({ song, patch }) => console.log(`  ${song.title} → ${patch.themes.join(', ')}`))
  if (plan.length > 10) console.log(`  … 외 ${plan.length - 10}곡`)
  if (!plan.length) return
  if ((await ask('\n이대로 저장할까요? (y/N): ')).toLowerCase() !== 'y') return console.log('저장하지 않았습니다.')

  let ok = 0
  for (const { song, patch } of plan) {
    try { await call('PUT', `/songs/${song._id}`, token, patch); ok++ }
    catch (err) { console.log(`  실패: ${song.title} — ${err.message}`) }
  }
  console.log(`\n${ok}곡에 주제를 넣었습니다.`)
}

const cmd = process.argv[2]
const done = () => rl?.close()
const run = cmd === 'export' ? exportMissing : cmd === 'apply' ? apply : null
if (!run) {
  console.log('사용법: node scripts/fill-themes.mjs export  |  node scripts/fill-themes.mjs apply')
  process.exit(1)
}
run().then(done).catch((err) => { done(); console.error(`\n오류: ${err.message}`); process.exit(1) })
