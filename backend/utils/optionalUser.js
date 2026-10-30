const jwt = require('jsonwebtoken')
const User = require('../models/User')

// 공유 화면처럼 로그인 없이도 열리는 요청에서, 로그인 정보가 함께 왔으면 확인한다.
// 잘못된 토큰이거나 비밀번호를 바꿔야 하는 계정이면 손님(null)으로 본다
module.exports = async function optionalUser(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
    if (decoded.aud) return null // 악보 파일 전용 쿠키(aud: sheets)는 로그인 토큰이 아니다
    const user = await User.findById(decoded.id).select('-password')
    if (!user || user.mustChangePassword) return null
    return user
  } catch {
    return null
  }
}
