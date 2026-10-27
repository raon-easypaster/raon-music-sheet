const crypto = require('crypto')

// 휴대폰에서 받아 적기 쉽도록 헷갈리는 글자(0 O 1 l I)를 뺀 소문자·숫자만 쓴다
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

function randomChars(n) {
  let out = ''
  for (let i = 0; i < n; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return out
}

// 예: raon-7kq3-m9xp-h4tw (4자 3묶음 ≈ 59비트 — 받아 적기 쉬우면서 추측으로 맞히기 어렵게)
exports.generateTempPassword = () => `raon-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`
