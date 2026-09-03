const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const songRoutes = require('./routes/songRoutes')
const setlistRoutes = require('./routes/setlistRoutes')
const authRoutes = require('./routes/authRoutes')
const teamRoutes = require('./routes/teamRoutes')

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api/songs', songRoutes)
app.use('/api/setlists', setlistRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/auth', authRoutes)

app.get('/', (req, res) => {
  res.send('RAON music sheet API running')
})

let connected = false
async function connectDB() {
  if (!connected) {
    await mongoose.connect(process.env.MONGO_URI)
    connected = true
  }
}

connectDB().catch(err => console.error('MongoDB error:', err.message))

module.exports = app
