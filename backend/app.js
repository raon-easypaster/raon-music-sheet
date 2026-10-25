const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const songRoutes = require('./routes/songRoutes')
const setlistRoutes = require('./routes/setlistRoutes')
const authRoutes = require('./routes/authRoutes')
const teamRoutes = require('./routes/teamRoutes')

const app = express()

// 서버리스(Vercel)에서는 함수가 새로 뜰 때마다 연결을 확인하고, 실패하면 다음 요청에서 다시 시도한다
let connecting = null
function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve()
  if (!process.env.MONGO_URI) return Promise.reject(new Error('MONGO_URI 환경 변수가 설정되지 않았습니다'))
  if (!connecting) {
    connecting = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
      .catch((err) => { connecting = null; throw err })
  }
  return connecting
}

app.use(cors())
app.use(express.json())
app.use('/api', async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (err) {
    console.error('MongoDB error:', err.message)
    res.status(503).json({ message: `데이터베이스에 연결하지 못했습니다: ${err.message}` })
  }
})
app.use('/api/songs', songRoutes)
app.use('/api/setlists', setlistRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/auth', authRoutes)

app.get('/', (req, res) => {
  res.send('RAON music sheet API running')
})

connectDB().catch(err => console.error('MongoDB error:', err.message))

module.exports = app
