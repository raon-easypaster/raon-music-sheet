const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const songRoutes = require('./routes/songRoutes')
const setlistRoutes = require('./routes/setlistRoutes')
const authRoutes = require('./routes/authRoutes')
const teamRoutes = require('./routes/teamRoutes')
const sheetRoutes = require('./routes/sheetRoutes')
const annotationRoutes = require('./routes/annotationRoutes')

const app = express()

// 접속 실패 원인을 찾기 위한 요약 (비밀번호 자체는 남기지 않는다)
function describeMongoUri(uri = '') {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/([^:]*):(.*)@([^@/?]+)(?:\/([^?]*))?/)
  if (!m) return { format: 'unrecognized', length: uri.length }
  const [, user, pass, host, db] = m
  return {
    user,
    host,
    db: db || '(none → test)',
    passwordLength: pass.length,
    passwordHasSpaces: /\s/.test(pass),
    passwordHasNonAscii: /[^\x20-\x7e]/.test(pass),
    passwordHasBrackets: /[<>]/.test(pass),
    passwordHasSpecialChars: /[^A-Za-z0-9]/.test(pass),
  }
}

// 비밀번호에 @ # % / 같은 특수문자가 그대로 들어 있으면 주소가 잘못 읽히므로, 비밀번호 부분만 URL 인코딩한다
// (이미 인코딩된 값은 한 번 풀었다가 다시 인코딩하므로 두 번 인코딩되지 않는다)
function normalizeMongoUri(uri = '') {
  const m = uri.trim().match(/^(mongodb(?:\+srv)?:\/\/)([^:@/]+):(.*)@([^@]*)$/)
  if (!m) return uri.trim()
  const [, scheme, user, pass, rest] = m
  let raw = pass
  try { raw = decodeURIComponent(pass) } catch { /* %가 들어간 원문 비밀번호 */ }
  return `${scheme}${user}:${encodeURIComponent(raw)}@${rest}`
}

// 서버리스(Vercel)에서는 함수가 새로 뜰 때마다 연결을 확인하고, 실패하면 다음 요청에서 다시 시도한다
let connecting = null
function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve()
  if (!process.env.MONGO_URI) return Promise.reject(new Error('MONGO_URI 환경 변수가 설정되지 않았습니다'))
  if (!connecting) {
    connecting = mongoose.connect(normalizeMongoUri(process.env.MONGO_URI), { serverSelectionTimeoutMS: 8000 })
      .catch((err) => { connecting = null; throw err })
  }
  return connecting
}

app.use(cors())
app.use(express.json({ limit: '6mb' })) // 악보 사진(base64) 업로드용
app.use('/api', async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (err) {
    console.error('MongoDB error:', err.message, describeMongoUri(process.env.MONGO_URI))
    res.status(503).json({ message: `데이터베이스에 연결하지 못했습니다: ${err.message}` })
  }
})
app.use('/api/songs', songRoutes)
app.use('/api/setlists', setlistRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/sheets', sheetRoutes)
app.use('/api/annotations', annotationRoutes)

app.get('/', (req, res) => {
  res.send('RAON music sheet API running')
})

connectDB().catch(err => console.error('MongoDB error:', err.message))

module.exports = app
