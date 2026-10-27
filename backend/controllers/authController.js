const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })
}

// 이메일은 앞뒤 공백을 지우고 소문자로 맞춘다 (가입·로그인 모두 같은 기준)
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const validateEmailAndPassword = (email, password) => {
  if (!email || !password) {
    return '이메일과 비밀번호를 입력해 주세요'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return '이메일 주소 형식이 올바르지 않습니다 (예: name@gmail.com)'
  }
  if (password.length < 6) {
    return '비밀번호는 6자 이상이어야 합니다'
  }
  return null
}

exports.signup = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email)
    const { password } = req.body

    const validationError = validateEmailAndPassword(email, password)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    const existingUser = await User.findOne({ email })

    if (existingUser) {
      return res.status(400).json({
        message: '이미 가입된 이메일입니다. 아래 "이미 계정이 있어요 → 로그인"으로 로그인해 주세요. 비밀번호를 잊었다면 팀장에게 비밀번호 초기화를 요청하세요',
      })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await User.create({
      email,
      password: hashedPassword,
    })

    res.status(201).json({
      _id: user._id,
      email: user.email,
      token: generateToken(user._id),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 입력해주세요' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: '비밀번호는 6자 이상이어야 합니다' })
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: '새 비밀번호는 지금 비밀번호와 달라야 합니다' })
    }
    const user = await User.findById(req.user._id)
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: '현재 비밀번호가 올바르지 않습니다' })
    }
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(newPassword, salt)
    user.mustChangePassword = false
    user.tempPasswordExpiresAt = null
    await user.save()
    res.json({ message: '비밀번호가 변경되었습니다' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해 주세요' })
    }

    const user = await User.findOne({ email: normalizeEmail(email) })

    if (!user) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 맞지 않습니다. 처음 오셨다면 아래 "회원가입"을 먼저 해 주세요' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 맞지 않습니다. 처음 오셨다면 아래 "회원가입"을 먼저 해 주세요' })
    }

    if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
      return res.status(400).json({ message: '임시 비밀번호가 만료되었습니다. 팀장에게 다시 초기화를 요청해 주세요' })
    }

    res.json({
      _id: user._id,
      email: user.email,
      mustChangePassword: !!user.mustChangePassword,
      token: generateToken(user._id),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}