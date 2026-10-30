// 앱 운영자: 서버 환경 변수 ADMIN_EMAILS(쉼표로 구분)에 적힌 이메일 계정. 저작권 신고를 처리한다
function operatorEmails() {
  return String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

const isOperator = (user) => !!user?.email && operatorEmails().includes(String(user.email).toLowerCase())

// protect 뒤에 붙여 쓴다
function requireOperator(req, res, next) {
  if (!isOperator(req.user)) return res.status(403).json({ message: '운영자만 볼 수 있습니다' })
  next()
}

module.exports = { isOperator, requireOperator, operatorEmails }
