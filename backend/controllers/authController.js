const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { takeAttempt, refundAttempt, clientIp } = require('../utils/rateLimit')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })
}

// 이메일은 앞뒤 공백을 지우고 소문자로 맞춘다 (가입·로그인 모두 같은 기준)
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

// 길이를 먼저 제한하고(이메일 표준 최대 254자), 겹치지 않는 패턴으로 검사해 느려지는 입력을 막는다
const isValidEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)
const INVALID_EMAIL = '이메일 주소 형식이 올바르지 않습니다 (예: name@gmail.com)'

const validateEmailAndPassword = (email, password) => {
  if (!email || !password) {
    return '이메일과 비밀번호를 입력해 주세요'
  }
  if (!isValidEmail(email)) {
    return INVALID_EMAIL
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

const LOGIN_FAIL_LIMIT = 20
const LOGIN_WINDOW_MS = 15 * 60 * 1000

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해 주세요' })
    }

    // 비밀번호를 마구 넣어 보지 못하도록 한 기기에서 15분에 20번까지만 틀릴 수 있다 (성공한 로그인은 세지 않음)
    const loginKey = `login:${clientIp(req)}`
    if (!(await takeAttempt(loginKey, LOGIN_FAIL_LIMIT, LOGIN_WINDOW_MS))) {
      return res.status(429).json({ message: '로그인을 너무 많이 실패했습니다. 15분 뒤 다시 시도하거나 팀장에게 비밀번호 초기화를 요청해 주세요' })
    }

    const user = await User.findOne({ email: normalizeEmail(email) })

    if (!user) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 맞지 않습니다. 처음 오셨다면 아래 "회원가입"을 먼저 해 주세요' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 맞지 않습니다. 처음 오셨다면 아래 "회원가입"을 먼저 해 주세요' })
    }

    await refundAttempt(loginKey)

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
// POST /auth/check-email  { email } → { registered }
// 가입한 이메일이 기억나지 않을 때 확인용. 다른 사람의 가입 여부를 마구 알아내지 못하도록
// 한 기기(IP)에서 15분에 10번까지만 확인할 수 있다
const EMAIL_CHECK_LIMIT = 10
const EMAIL_CHECK_WINDOW_MS = 15 * 60 * 1000
// 기기(IP)를 바꿔 가며 대량으로 확인하지 못하도록 사이트 전체로도 1시간에 100번까지만
const EMAIL_CHECK_GLOBAL_LIMIT = 100
const EMAIL_CHECK_GLOBAL_WINDOW_MS = 60 * 60 * 1000

exports.checkEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email)
    if (!email) return res.status(400).json({ message: '확인할 이메일을 입력해 주세요' })
    if (!isValidEmail(email)) return res.status(400).json({ message: INVALID_EMAIL })
    if (!(await takeAttempt(`email-check:${clientIp(req)}`, EMAIL_CHECK_LIMIT, EMAIL_CHECK_WINDOW_MS))) {
      return res.status(429).json({ message: '확인을 너무 많이 했습니다. 15분 뒤 다시 시도하거나 팀장에게 문의해 주세요' })
    }
    if (!(await takeAttempt('email-check:all', EMAIL_CHECK_GLOBAL_LIMIT, EMAIL_CHECK_GLOBAL_WINDOW_MS))) {
      return res.status(429).json({ message: '지금은 이메일 확인 요청이 많아 잠시 멈췄습니다. 잠시 뒤 다시 시도하거나 팀장에게 문의해 주세요' })
    }
    const registered = !!(await User.exists({ email }))
    res.json({ email, registered })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
